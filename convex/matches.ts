import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { computeDynamicPrice } from "../packages/shared/pricing";
import { computeMatchScore, explainRanking, sizeIsCompatible } from "./lib/matching";
import { distancePointToSegmentKm, windowsOverlap } from "./lib/geo";

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
  return {
    detourDistanceKm: Math.round(detourDistanceKm * 100) / 100,
    detourMinutes: Math.round(detourMinutes),
  };
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
