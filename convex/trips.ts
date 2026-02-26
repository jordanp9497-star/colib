import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { approximateZoneKey } from "./lib/geo";
import { formatAddressShort } from "./lib/address";

const addressInput = v.object({
  label: v.string(),
  city: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  countryCode: v.optional(v.string()),
  placeId: v.string(),
  lat: v.number(),
  lng: v.number(),
});

export const list = query({
  handler: async (ctx) => {
    const trips = await ctx.db
      .query("trips")
      .withIndex("by_status_publishedAt", (q) => q.eq("status", "published"))
      .order("desc")
      .collect();

    const profileByVisitorId = new Map<
      string,
      {
        name: string;
        profilePhotoUrl: string | null;
        averageRating: number | null;
        totalReviews: number;
      }
    >();

    return await Promise.all(
      trips.map(async (trip) => {
        const ownerId = trip.ownerVisitorId;
        let profile = profileByVisitorId.get(ownerId);

        if (!profile) {
          const user = await ctx.db
            .query("users")
            .withIndex("by_visitorId", (q) => q.eq("visitorId", ownerId))
            .first();

          const profilePhotoUrl = user?.profilePhotoId
            ? await ctx.storage.getUrl(user.profilePhotoId)
            : null;

          profile = {
            name: user?.name ?? trip.userName,
            profilePhotoUrl,
            averageRating: user?.averageRating ?? null,
            totalReviews: user?.totalReviews ?? 0,
          };

          profileByVisitorId.set(ownerId, profile);
        }

        return {
          ...trip,
          carrierProfile: profile,
        };
      })
    );
  },
});

export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const trips = await ctx.db
      .query("trips")
      .withIndex("by_owner_status", (q) => q.eq("ownerVisitorId", args.userId))
      .collect();
    return trips.filter((trip) => trip.status !== "cancelled");
  },
});

export const getById = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.tripId);
  },
});

export const create = mutation({
  args: {
    ownerVisitorId: v.string(),
    userName: v.string(),
    originAddress: addressInput,
    destinationAddress: addressInput,
    windowStartTs: v.number(),
    windowEndTs: v.number(),
    availableSpace: v.union(v.literal("petit"), v.literal("moyen"), v.literal("grand")),
    maxWeightKg: v.number(),
    maxVolumeDm3: v.number(),
    price: v.number(),
    maxDetourMinutes: v.number(),
    description: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("trips", {
      ownerVisitorId: args.ownerVisitorId,
      userId: args.ownerVisitorId,
      userName: args.userName,
      origin: formatAddressShort(args.originAddress),
      destination: formatAddressShort(args.destinationAddress),
      originAddress: args.originAddress,
      destinationAddress: args.destinationAddress,
      routePolyline: undefined,
      routeDistanceKm: undefined,
      routeDurationMinutes: undefined,
      date: new Date(args.windowStartTs).toISOString(),
      windowStartTs: args.windowStartTs,
      windowEndTs: args.windowEndTs,
      availableSpace: args.availableSpace,
      maxWeightKg: args.maxWeightKg,
      maxVolumeDm3: args.maxVolumeDm3,
      price: args.price,
      maxDetourMinutes: args.maxDetourMinutes,
      description: args.description,
      phone: args.phone,
      status: "published",
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
      approxZoneKey: approximateZoneKey(args.originAddress, args.destinationAddress),
    });

    return id;
  },
});

export const updateDetourLimit = mutation({
  args: {
    tripId: v.id("trips"),
    ownerVisitorId: v.string(),
    maxDetourMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.tripId);
    if (!trip) throw new Error("Trip introuvable");
    if (trip.ownerVisitorId !== args.ownerVisitorId) {
      throw new Error("Non autorise");
    }

    await ctx.db.patch(args.tripId, {
      maxDetourMinutes: args.maxDetourMinutes,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    tripId: v.id("trips"),
    ownerVisitorId: v.string(),
    originAddress: addressInput,
    destinationAddress: addressInput,
    windowStartTs: v.number(),
    windowEndTs: v.number(),
    availableSpace: v.union(v.literal("petit"), v.literal("moyen"), v.literal("grand")),
    maxWeightKg: v.number(),
    maxVolumeDm3: v.number(),
    price: v.number(),
    maxDetourMinutes: v.number(),
    description: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.tripId);
    if (!trip) throw new Error("Trip introuvable");
    if (trip.ownerVisitorId !== args.ownerVisitorId) {
      throw new Error("Non autorise");
    }

    await ctx.db.patch(args.tripId, {
      origin: formatAddressShort(args.originAddress),
      destination: formatAddressShort(args.destinationAddress),
      originAddress: args.originAddress,
      destinationAddress: args.destinationAddress,
      date: new Date(args.windowStartTs).toISOString(),
      windowStartTs: args.windowStartTs,
      windowEndTs: args.windowEndTs,
      availableSpace: args.availableSpace,
      maxWeightKg: args.maxWeightKg,
      maxVolumeDm3: args.maxVolumeDm3,
      price: args.price,
      maxDetourMinutes: args.maxDetourMinutes,
      description: args.description,
      phone: args.phone,
      status: "published",
      updatedAt: Date.now(),
      approxZoneKey: approximateZoneKey(args.originAddress, args.destinationAddress),
    });
  },
});

export const remove = mutation({
  args: {
    tripId: v.id("trips"),
    ownerVisitorId: v.string(),
  },
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.tripId);
    if (!trip) throw new Error("Trip introuvable");
    if (trip.ownerVisitorId !== args.ownerVisitorId) {
      throw new Error("Non autorise");
    }

    const relatedMatches = await ctx.db
      .query("matches")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .collect();

    for (const match of relatedMatches) {
      await ctx.db.delete(match._id);
    }

    await ctx.db.patch(args.tripId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
  },
});
