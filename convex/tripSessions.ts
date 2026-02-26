import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { rankTripSessionCandidates } from "../packages/shared/tripSessionMatching";

const addressInput = v.object({
  label: v.string(),
  city: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  countryCode: v.optional(v.string()),
  placeId: v.string(),
  lat: v.number(),
  lng: v.number(),
});

const locationInput = v.object({
  lat: v.number(),
  lng: v.number(),
  timestamp: v.number(),
});

async function computeMatchesForSession(
  ctx: { db: any },
  session: {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    deviationMaxMinutes: 5 | 10 | 20 | 30;
  },
  limit?: number
) {
  const parcels = await ctx.db
    .query("parcels")
    .withIndex("by_status_windowStart", (q: any) => q.eq("status", "published"))
    .collect();

  const ranked = rankTripSessionCandidates({
    origin: { lat: session.origin.lat, lng: session.origin.lng },
    destination: { lat: session.destination.lat, lng: session.destination.lng },
    deviationMaxMinutes: session.deviationMaxMinutes,
    candidates: parcels.map((parcel: any) => ({
      parcelId: String(parcel._id),
      pickupLabel: parcel.originAddress.label ?? parcel.origin,
      dropLabel: parcel.destinationAddress.label ?? parcel.destination,
      pickup: { lat: parcel.originAddress.lat, lng: parcel.originAddress.lng },
      drop: { lat: parcel.destinationAddress.lat, lng: parcel.destinationAddress.lng },
    })),
    limit,
  });

  return ranked;
}

async function patchUserRealtimeState(
  ctx: { db: any },
  userId: string,
  payload: { isOnline?: boolean; location?: { lat: number; lng: number } }
) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_visitorId", (q: any) => q.eq("visitorId", userId))
    .first();
  if (!user) return;

  await ctx.db.patch(user._id, {
    isOnline: payload.isOnline ?? user.isOnline ?? false,
    lastActiveAt: Date.now(),
    lastKnownLocation: payload.location
      ? {
          lat: payload.location.lat,
          lng: payload.location.lng,
          updatedAt: Date.now(),
        }
      : user.lastKnownLocation,
  });
}

export const getActiveByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("tripSessions")
      .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "ACTIVE"))
      .order("desc")
      .collect();
    return sessions[0] ?? null;
  },
});

export const getById = query({
  args: { tripSessionId: v.id("tripSessions"), userId: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.tripSessionId);
    if (!session || session.userId !== args.userId) {
      return null;
    }
    return session;
  },
});

export const start = mutation({
  args: {
    userId: v.string(),
    origin: addressInput,
    destination: addressInput,
    deviationMaxMinutes: v.union(v.literal(5), v.literal(10), v.literal(20), v.literal(30)),
    opportunitiesEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const activeSessions = await ctx.db
      .query("tripSessions")
      .withIndex("by_user_status", (q) => q.eq("userId", args.userId).eq("status", "ACTIVE"))
      .collect();

    for (const session of activeSessions) {
      await ctx.db.patch(session._id, {
        status: "STOPPED",
        endedAt: now,
        updatedAt: now,
      });
    }

    const tripSessionId = await ctx.db.insert("tripSessions", {
      userId: args.userId,
      origin: args.origin,
      destination: args.destination,
      deviationMaxMinutes: args.deviationMaxMinutes,
      opportunitiesEnabled: args.opportunitiesEnabled,
      status: "ACTIVE",
      startedAt: now,
      endedAt: undefined,
      lastLocation: undefined,
      lastNotifiedAt: undefined,
      matchesCountCache: 0,
      createdAt: now,
      updatedAt: now,
    });

    await patchUserRealtimeState(ctx, args.userId, { isOnline: true });

    return { tripSessionId };
  },
});

export const pushLocation = mutation({
  args: {
    tripSessionId: v.id("tripSessions"),
    userId: v.string(),
    location: locationInput,
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.tripSessionId);
    if (!session) throw new Error("Session de trajet introuvable");
    if (session.userId !== args.userId) throw new Error("Non autorise");
    if (session.status !== "ACTIVE") {
      return { matchesCount: session.matchesCountCache, shouldNotify: false };
    }

    const matches = await computeMatchesForSession(ctx, session, 50);
    const newCount = matches.length;
    const oldCount = session.matchesCountCache ?? 0;
    const now = Date.now();
    const cooldownMs = 10 * 60 * 1000;
    const cooldownElapsed = !session.lastNotifiedAt || now - session.lastNotifiedAt >= cooldownMs;
    const hasNewMatches = (oldCount === 0 && newCount > 0) || newCount > oldCount;
    const shouldNotify = session.opportunitiesEnabled && hasNewMatches && cooldownElapsed;

    await ctx.db.patch(args.tripSessionId, {
      lastLocation: args.location,
      matchesCountCache: newCount,
      lastNotifiedAt: shouldNotify ? now : session.lastNotifiedAt,
      updatedAt: now,
    });

    await patchUserRealtimeState(ctx, args.userId, {
      isOnline: true,
      location: { lat: args.location.lat, lng: args.location.lng },
    });

    if (shouldNotify) {
      await ctx.db.insert("notifications", {
        recipientVisitorId: session.userId,
        actorVisitorId: undefined,
        type: "trip_session_matches",
        title: `${newCount} colis dispo sur votre trajet`,
        message: `Vers ${session.destination.city ?? session.destination.label}`,
        tripId: undefined,
        parcelId: undefined,
        matchId: undefined,
        readAt: undefined,
        createdAt: now,
      });
    }

    return {
      matchesCount: newCount,
      previousMatchesCount: oldCount,
      shouldNotify,
      destinationLabel: session.destination.label,
    };
  },
});

export const listMatches = query({
  args: {
    tripSessionId: v.id("tripSessions"),
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.tripSessionId);
    if (!session || session.userId !== args.userId) {
      return [];
    }

    const limit = args.limit && args.limit > 0 ? Math.min(args.limit, 100) : 50;
    const ranked = await computeMatchesForSession(ctx, session, limit);

    const ids = ranked.map((item) => item.parcelId as Id<"parcels">);
    const parcels = await Promise.all(ids.map((id) => ctx.db.get(id)));
    const parcelById = new Map(
      parcels.filter((parcel): parcel is NonNullable<typeof parcel> => Boolean(parcel)).map((parcel) => [String(parcel._id), parcel])
    );

    return ranked
      .map((entry) => {
        const parcel = parcelById.get(entry.parcelId);
        if (!parcel) return null;
        return {
          parcelId: entry.parcelId,
          pickupLabel: entry.pickupLabel,
          dropLabel: entry.dropLabel,
          score: entry.score,
          estimatedDetourMinutes: entry.estimatedDetourMinutes,
          pickupDistanceToCorridorKm: entry.pickupDistanceToCorridorKm,
          dropDistanceToDestinationKm: entry.dropDistanceToDestinationKm,
          size: parcel.size,
          description: parcel.description,
          urgencyLevel: parcel.urgencyLevel,
          weight: parcel.weight,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  },
});

export const stop = mutation({
  args: {
    tripSessionId: v.id("tripSessions"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.tripSessionId);
    if (!session) throw new Error("Session de trajet introuvable");
    if (session.userId !== args.userId) throw new Error("Non autorise");
    if (session.status !== "ACTIVE") return { success: true };

    const now = Date.now();
    await ctx.db.patch(args.tripSessionId, {
      status: "STOPPED",
      endedAt: now,
      updatedAt: now,
    });

    await patchUserRealtimeState(ctx, args.userId, { isOnline: false });

    return { success: true };
  },
});
