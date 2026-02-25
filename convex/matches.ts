import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { computeDynamicPrice } from "../packages/shared/pricing";
import { computeMatchScore, explainRanking, sizeIsCompatible } from "./lib/matching";
import { distancePointToSegmentKm, windowsOverlap } from "./lib/geo";

async function validateCarrierComplianceOrThrow(
  ctx: MutationCtx,
  carrierVisitorId: string
) {
  const compliance = await ctx.db
    .query("carrierCompliance")
    .withIndex("by_carrier", (q) => q.eq("carrierVisitorId", carrierVisitorId))
    .first();

  if (!compliance) {
    throw new Error("Transporteur non conforme: documents non soumis");
  }
  if (compliance.status !== "approved") {
    throw new Error("Transporteur non conforme: validation en attente ou refusee");
  }

  const now = Date.now();
  if (
    (compliance.idCardExpiresAt !== undefined && compliance.idCardExpiresAt <= now) ||
    (compliance.carteGriseExpiresAt !== undefined && compliance.carteGriseExpiresAt <= now)
  ) {
    throw new Error("Transporteur non conforme: document expire");
  }

  return compliance;
}

function estimateDetourMinutes(
  trip: { originAddress: { lat: number; lng: number }; destinationAddress: { lat: number; lng: number } },
  parcel: { originAddress: { lat: number; lng: number }; destinationAddress: { lat: number; lng: number } }
) {
  const pickupToRoute = distancePointToSegmentKm(
    parcel.originAddress,
    trip.originAddress,
    trip.destinationAddress
  );
  const dropToRoute = distancePointToSegmentKm(
    parcel.destinationAddress,
    trip.originAddress,
    trip.destinationAddress
  );
  const detourDistanceKm = (pickupToRoute + dropToRoute) * 1.4;
  const detourMinutes = (detourDistanceKm / 45) * 60;
  const pickupProgress = projectProgressOnSegment(
    parcel.originAddress,
    trip.originAddress,
    trip.destinationAddress
  );
  const dropProgress = projectProgressOnSegment(
    parcel.destinationAddress,
    trip.originAddress,
    trip.destinationAddress
  );
  return {
    detourDistanceKm: Math.round(detourDistanceKm * 100) / 100,
    detourMinutes: Math.round(detourMinutes),
    pickupProgress,
    dropProgress,
  };
}

function projectProgressOnSegment(
  point: { lat: number; lng: number },
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
) {
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return 0;
  const rawT = ((point.lng - start.lng) * dx + (point.lat - start.lat) * dy) / lengthSq;
  return Math.max(0, Math.min(1, rawT));
}

export const listByParcel = query({
  args: { parcelId: v.id("parcels") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("matches")
      .withIndex("by_parcel_score", (q) => q.eq("parcelId", args.parcelId))
      .order("desc")
      .collect();
  },
});

export const listByTrip = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("matches")
      .withIndex("by_trip_score", (q) => q.eq("tripId", args.tripId))
      .order("desc")
      .collect();
  },
});

export const recomputeForParcel = mutation({
  args: {
    parcelId: v.id("parcels"),
  },
  handler: async (ctx, args) => {
    const parcel = await ctx.db.get(args.parcelId);
    if (!parcel || parcel.status !== "published") return { count: 0 };

    const candidateTrips = await ctx.db
      .query("trips")
      .withIndex("by_status_windowStart", (q) => q.eq("status", "published"))
      .collect();

    const existing = await ctx.db
      .query("matches")
      .withIndex("by_parcel", (q) => q.eq("parcelId", args.parcelId))
      .collect();

    const previouslyMatchedTripIds = new Set(existing.map((match) => String(match.tripId)));

    for (const match of existing) {
      await ctx.db.delete(match._id);
    }

    let count = 0;
    for (const trip of candidateTrips) {
      if (
        !windowsOverlap(
          trip.windowStartTs,
          trip.windowEndTs,
          parcel.preferredWindowStartTs,
          parcel.preferredWindowEndTs
        )
      ) {
        continue;
      }
      if (!sizeIsCompatible(trip.availableSpace, parcel.size)) continue;
      if (trip.maxWeightKg < parcel.weight) continue;
      if (trip.maxVolumeDm3 < parcel.volumeDm3) continue;

      const detour = estimateDetourMinutes(trip, parcel);
      if (detour.dropProgress + 0.03 < detour.pickupProgress) continue;
      if (detour.detourMinutes > trip.maxDetourMinutes + 5) continue;

      const pricing = computeDynamicPrice({
        baseDistanceKm: detour.detourDistanceKm,
        weightKg: parcel.weight,
        volumeDm3: parcel.volumeDm3,
        detourMinutes: detour.detourMinutes,
        urgencyLevel: parcel.urgencyLevel,
        fragile: parcel.fragile,
        insuranceValue: parcel.insuranceValue,
      });

      const overlapMin =
        Math.min(trip.windowEndTs, parcel.preferredWindowEndTs) -
        Math.max(trip.windowStartTs, parcel.preferredWindowStartTs);

      const score = computeMatchScore({
        detourMinutes: detour.detourMinutes,
        driverDetourLimit: trip.maxDetourMinutes,
        windowOverlapMinutes: Math.max(0, overlapMin / 60000),
        baseRouteMinutes: trip.routeDurationMinutes ?? 90,
        estimatedPrice: pricing.totalAmount,
      });

      await ctx.db.insert("matches", {
        tripId: trip._id,
        parcelId: parcel._id,
        status: "candidate",
        score,
        detourMinutes: detour.detourMinutes,
        detourDistanceKm: detour.detourDistanceKm,
        routeDistanceKm: trip.routeDistanceKm ?? 0,
        routeDurationMinutes: trip.routeDurationMinutes ?? 0,
        pricingEstimate: pricing,
        rankingReason: explainRanking(score, pricing),
        expiresAt: Date.now() + 1000 * 60 * 60 * 24,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const isNewMatchForTrip = !previouslyMatchedTripIds.has(String(trip._id));
      if (isNewMatchForTrip && trip.ownerVisitorId !== parcel.ownerVisitorId) {
        await ctx.db.insert("notifications", {
          recipientVisitorId: trip.ownerVisitorId,
          actorVisitorId: parcel.ownerVisitorId,
          type: "new_match_for_trip",
          title: "Nouveau colis compatible",
          message: `${parcel.origin} -> ${parcel.destination}`,
          tripId: trip._id,
          parcelId: parcel._id,
          readAt: undefined,
          createdAt: Date.now(),
        });
      }

      count += 1;
    }

    return { count };
  },
});

export const recomputeForTrip = mutation({
  args: {
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.status !== "published") return { count: 0 };

    const parcels = await ctx.db
      .query("parcels")
      .withIndex("by_status_windowStart", (q) => q.eq("status", "published"))
      .collect();

    const existing = await ctx.db
      .query("matches")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .collect();

    for (const match of existing) {
      await ctx.db.delete(match._id);
    }

    let count = 0;
    for (const parcel of parcels) {
      if (
        !windowsOverlap(
          trip.windowStartTs,
          trip.windowEndTs,
          parcel.preferredWindowStartTs,
          parcel.preferredWindowEndTs
        )
      ) {
        continue;
      }
      if (!sizeIsCompatible(trip.availableSpace, parcel.size)) continue;
      if (trip.maxWeightKg < parcel.weight) continue;
      if (trip.maxVolumeDm3 < parcel.volumeDm3) continue;

      const detour = estimateDetourMinutes(trip, parcel);
      if (detour.dropProgress + 0.03 < detour.pickupProgress) continue;
      if (detour.detourMinutes > trip.maxDetourMinutes + 5) continue;

      const pricing = computeDynamicPrice({
        baseDistanceKm: detour.detourDistanceKm,
        weightKg: parcel.weight,
        volumeDm3: parcel.volumeDm3,
        detourMinutes: detour.detourMinutes,
        urgencyLevel: parcel.urgencyLevel,
        fragile: parcel.fragile,
        insuranceValue: parcel.insuranceValue,
      });

      const overlapMin =
        Math.min(trip.windowEndTs, parcel.preferredWindowEndTs) -
        Math.max(trip.windowStartTs, parcel.preferredWindowStartTs);

      const score = computeMatchScore({
        detourMinutes: detour.detourMinutes,
        driverDetourLimit: trip.maxDetourMinutes,
        windowOverlapMinutes: Math.max(0, overlapMin / 60000),
        baseRouteMinutes: trip.routeDurationMinutes ?? 90,
        estimatedPrice: pricing.totalAmount,
      });

      await ctx.db.insert("matches", {
        tripId: trip._id,
        parcelId: parcel._id,
        status: "candidate",
        score,
        detourMinutes: detour.detourMinutes,
        detourDistanceKm: detour.detourDistanceKm,
        routeDistanceKm: trip.routeDistanceKm ?? 0,
        routeDurationMinutes: trip.routeDurationMinutes ?? 0,
        pricingEstimate: pricing,
        rankingReason: explainRanking(score, pricing),
        expiresAt: Date.now() + 1000 * 60 * 60 * 24,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      count += 1;
    }

    return { count };
  },
});

export const reserveFromTripOwner = mutation({
  args: {
    matchId: v.id("matches"),
    tripOwnerVisitorId: v.string(),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) throw new Error("Match introuvable");
    if (match.status !== "candidate") {
      throw new Error("Ce match n est plus reservable");
    }

    const trip = await ctx.db.get(match.tripId);
    if (!trip) throw new Error("Trajet introuvable");
    if (trip.ownerVisitorId !== args.tripOwnerVisitorId) {
      throw new Error("Non autorise");
    }

    const parcel = await ctx.db.get(match.parcelId);
    if (!parcel) throw new Error("Colis introuvable");

    const now = Date.now();
    await ctx.db.patch(match._id, {
      status: "requested",
      updatedAt: now,
    });

    await ctx.db.patch(parcel._id, {
      status: "matched",
      updatedAt: now,
    });

    if (parcel.ownerVisitorId !== trip.ownerVisitorId) {
      await ctx.db.insert("notifications", {
        recipientVisitorId: parcel.ownerVisitorId,
        actorVisitorId: trip.ownerVisitorId,
        type: "reservation_request",
        title: "Nouvelle demande de reservation",
        message: `${trip.userName} souhaite transporter votre colis`,
        matchId: match._id,
        tripId: trip._id,
        parcelId: parcel._id,
        readAt: undefined,
        createdAt: now,
      });
    }

    return { success: true };
  },
});

export const acceptReservationRequest = mutation({
  args: {
    matchId: v.id("matches"),
    parcelOwnerVisitorId: v.string(),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) throw new Error("Match introuvable");

    const parcel = await ctx.db.get(match.parcelId);
    if (!parcel) throw new Error("Colis introuvable");
    if (parcel.ownerVisitorId !== args.parcelOwnerVisitorId) {
      throw new Error("Non autorise");
    }
    if (match.status !== "requested") {
      throw new Error("Cette demande ne peut plus etre acceptee");
    }

    const trip = await ctx.db.get(match.tripId);
    if (!trip) throw new Error("Trajet introuvable");

    await validateCarrierComplianceOrThrow(ctx, trip.ownerVisitorId);

    const now = Date.now();
    await ctx.db.patch(match._id, {
      status: "accepted",
      updatedAt: now,
    });

    const siblingMatches = await ctx.db
      .query("matches")
      .withIndex("by_parcel", (q) => q.eq("parcelId", match.parcelId))
      .collect();

    for (const sibling of siblingMatches) {
      if (sibling._id === match._id) continue;
      if (sibling.status !== "candidate" && sibling.status !== "requested") continue;
      await ctx.db.patch(sibling._id, {
        status: "rejected",
        updatedAt: now,
      });
    }

    await ctx.db.patch(parcel._id, {
      status: "booked",
      matchedTripId: trip._id,
      pricingEstimate: match.pricingEstimate,
      updatedAt: now,
    });

    const existingShipment = await ctx.db
      .query("shipments")
      .withIndex("by_match", (q) => q.eq("matchId", match._id))
      .first();

    if (!existingShipment) {
      const shipmentId = await ctx.db.insert("shipments", {
        matchId: match._id,
        tripId: trip._id,
        parcelId: parcel._id,
        carrierVisitorId: trip.ownerVisitorId,
        customerVisitorId: parcel.ownerVisitorId,
        status: "carrier_assigned",
        insuranceEligible: true,
        insuranceBlockedReason: undefined,
        lastTrackingAt: undefined,
        deliveredAt: undefined,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("shipmentEvents", {
        shipmentId,
        eventType: "shipment_created",
        actorVisitorId: parcel.ownerVisitorId,
        fromStatus: undefined,
        toStatus: "carrier_assigned",
        payload: {
          tripId: trip._id,
          parcelId: parcel._id,
          amount: match.pricingEstimate.totalAmount,
        },
        createdAt: now,
      });

      await ctx.db.insert("shipmentMessages", {
        shipmentId,
        senderVisitorId: parcel.ownerVisitorId,
        senderRole: "system",
        body: "Transport confirme. Utilisez cette messagerie pour echanger en securite.",
        moderationFlags: [],
        createdAt: now,
        readAt: undefined,
      });
    }

    if (trip.ownerVisitorId !== parcel.ownerVisitorId) {
      await ctx.db.insert("notifications", {
        recipientVisitorId: trip.ownerVisitorId,
        actorVisitorId: parcel.ownerVisitorId,
        type: "reservation_accepted",
        title: "Demande acceptee",
        message: "Le publicateur du colis a valide votre reservation",
        matchId: match._id,
        tripId: trip._id,
        parcelId: parcel._id,
        readAt: undefined,
        createdAt: now,
      });
    }

    await ctx.db.insert("notifications", {
      recipientVisitorId: parcel.ownerVisitorId,
      actorVisitorId: trip.ownerVisitorId,
      type: "payment_required",
      title: "Paiement requis (BETA)",
      message: `Confirmez le paiement de ${match.pricingEstimate.totalAmount} EUR pour finaliser le transport`,
      matchId: match._id,
      tripId: trip._id,
      parcelId: parcel._id,
      readAt: undefined,
      createdAt: now,
    });

    return { success: true };
  },
});
