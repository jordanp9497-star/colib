import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { approximateZoneKey } from "./lib/geo";

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
    return await ctx.db
      .query("parcels")
      .withIndex("by_status_windowStart", (q) => q.eq("status", "published"))
      .order("desc")
      .collect();
  },
});

export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const parcels = await ctx.db
      .query("parcels")
      .withIndex("by_owner_status", (q) => q.eq("ownerVisitorId", args.userId))
      .collect();
    return parcels.filter((parcel) => parcel.status !== "cancelled");
  },
});

export const getById = query({
  args: { parcelId: v.id("parcels") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.parcelId);
  },
});

export const create = mutation({
  args: {
    ownerVisitorId: v.string(),
    userName: v.string(),
    originAddress: addressInput,
    destinationAddress: addressInput,
    size: v.union(v.literal("petit"), v.literal("moyen"), v.literal("grand")),
    weight: v.number(),
    volumeDm3: v.number(),
    description: v.string(),
    fragile: v.boolean(),
    urgencyLevel: v.union(v.literal("normal"), v.literal("urgent"), v.literal("express")),
    insuranceValue: v.optional(v.number()),
    preferredWindowStartTs: v.number(),
    preferredWindowEndTs: v.number(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("parcels", {
      ownerVisitorId: args.ownerVisitorId,
      userId: args.ownerVisitorId,
      userName: args.userName,
      origin: args.originAddress.label,
      destination: args.destinationAddress.label,
      originAddress: args.originAddress,
      destinationAddress: args.destinationAddress,
      size: args.size,
      weight: args.weight,
      volumeDm3: args.volumeDm3,
      description: args.description,
      fragile: args.fragile,
      urgencyLevel: args.urgencyLevel,
      insuranceValue: args.insuranceValue,
      phone: args.phone,
      status: "published",
      preferredWindowStartTs: args.preferredWindowStartTs,
      preferredWindowEndTs: args.preferredWindowEndTs,
      publishedAt: now,
      matchedTripId: undefined,
      pricingEstimate: undefined,
      createdAt: now,
      updatedAt: now,
      approxZoneKey: approximateZoneKey(args.originAddress, args.destinationAddress),
    });

    return { parcelId: id };
  },
});

export const update = mutation({
  args: {
    parcelId: v.id("parcels"),
    ownerVisitorId: v.string(),
    originAddress: addressInput,
    destinationAddress: addressInput,
    size: v.union(v.literal("petit"), v.literal("moyen"), v.literal("grand")),
    weight: v.number(),
    volumeDm3: v.number(),
    description: v.string(),
    fragile: v.boolean(),
    urgencyLevel: v.union(v.literal("normal"), v.literal("urgent"), v.literal("express")),
    insuranceValue: v.optional(v.number()),
    preferredWindowStartTs: v.number(),
    preferredWindowEndTs: v.number(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const parcel = await ctx.db.get(args.parcelId);
    if (!parcel) throw new Error("Colis introuvable");
    if (parcel.ownerVisitorId !== args.ownerVisitorId) {
      throw new Error("Non autorise");
    }

    await ctx.db.patch(args.parcelId, {
      origin: args.originAddress.label,
      destination: args.destinationAddress.label,
      originAddress: args.originAddress,
      destinationAddress: args.destinationAddress,
      size: args.size,
      weight: args.weight,
      volumeDm3: args.volumeDm3,
      description: args.description,
      fragile: args.fragile,
      urgencyLevel: args.urgencyLevel,
      insuranceValue: args.insuranceValue,
      phone: args.phone,
      status: "published",
      preferredWindowStartTs: args.preferredWindowStartTs,
      preferredWindowEndTs: args.preferredWindowEndTs,
      updatedAt: Date.now(),
      approxZoneKey: approximateZoneKey(args.originAddress, args.destinationAddress),
    });
  },
});

export const remove = mutation({
  args: {
    parcelId: v.id("parcels"),
    ownerVisitorId: v.string(),
  },
  handler: async (ctx, args) => {
    const parcel = await ctx.db.get(args.parcelId);
    if (!parcel) throw new Error("Colis introuvable");
    if (parcel.ownerVisitorId !== args.ownerVisitorId) {
      throw new Error("Non autorise");
    }

    const relatedMatches = await ctx.db
      .query("matches")
      .withIndex("by_parcel", (q) => q.eq("parcelId", args.parcelId))
      .collect();

    for (const match of relatedMatches) {
      await ctx.db.delete(match._id);
    }

    await ctx.db.patch(args.parcelId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
  },
});
