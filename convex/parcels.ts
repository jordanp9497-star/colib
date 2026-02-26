import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { approximateZoneKey } from "./lib/geo";
import { formatAddressShort } from "./lib/address";
import { consumeRateLimit } from "./lib/rateLimit";
import { triggerSmartNotificationsForParcel } from "./smartNotifications";

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
    const parcel = await ctx.db.get(args.parcelId);
    if (!parcel) return null;
    const parcelPhotoUrl = parcel.parcelPhotoId
      ? await ctx.storage.getUrl(parcel.parcelPhotoId)
      : null;
    return {
      ...parcel,
      parcelPhotoUrl,
    };
  },
});

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
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
    proposedPrice: v.optional(v.number()),
    preferredWindowStartTs: v.number(),
    preferredWindowEndTs: v.number(),
    phone: v.optional(v.string()),
    recipientPhone: v.optional(v.string()),
    parcelPhotoId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const rateCheck = await consumeRateLimit({
      ctx,
      key: `create_parcel:${args.ownerVisitorId}`,
      limit: 8,
      windowMs: 10 * 60 * 1000,
    });
    if (!rateCheck.allowed) {
      throw new Error("Trop de creations de colis. Reessayez dans quelques minutes.");
    }

    const now = Date.now();
    const id = await ctx.db.insert("parcels", {
      ownerVisitorId: args.ownerVisitorId,
      userId: args.ownerVisitorId,
      userName: args.userName,
      origin: formatAddressShort(args.originAddress),
      destination: formatAddressShort(args.destinationAddress),
      originAddress: args.originAddress,
      destinationAddress: args.destinationAddress,
      size: args.size,
      weight: args.weight,
      volumeDm3: args.volumeDm3,
      description: args.description,
      fragile: args.fragile,
      urgencyLevel: args.urgencyLevel,
      insuranceValue: args.insuranceValue,
      proposedPrice: args.proposedPrice,
      phone: args.phone,
      recipientPhone: args.recipientPhone,
      parcelPhotoId: args.parcelPhotoId,
      status: "published",
      preferredWindowStartTs: args.preferredWindowStartTs,
      preferredWindowEndTs: args.preferredWindowEndTs,
      publishedAt: now,
      matchedTripId: undefined,
      matchedDriverId: undefined,
      matchedAt: undefined,
      pricingEstimate: undefined,
      createdAt: now,
      updatedAt: now,
      approxZoneKey: approximateZoneKey(args.originAddress, args.destinationAddress),
    });

    await triggerSmartNotificationsForParcel(ctx, id);

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
    proposedPrice: v.optional(v.number()),
    preferredWindowStartTs: v.number(),
    preferredWindowEndTs: v.number(),
    phone: v.optional(v.string()),
    recipientPhone: v.optional(v.string()),
    parcelPhotoId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const parcel = await ctx.db.get(args.parcelId);
    if (!parcel) throw new Error("Colis introuvable");
    if (parcel.ownerVisitorId !== args.ownerVisitorId) {
      throw new Error("Non autorise");
    }

    if (parcel.parcelPhotoId && args.parcelPhotoId && String(parcel.parcelPhotoId) !== String(args.parcelPhotoId)) {
      await ctx.storage.delete(parcel.parcelPhotoId);
    }

    await ctx.db.patch(args.parcelId, {
      origin: formatAddressShort(args.originAddress),
      destination: formatAddressShort(args.destinationAddress),
      originAddress: args.originAddress,
      destinationAddress: args.destinationAddress,
      size: args.size,
      weight: args.weight,
      volumeDm3: args.volumeDm3,
      description: args.description,
      fragile: args.fragile,
      urgencyLevel: args.urgencyLevel,
      insuranceValue: args.insuranceValue,
      proposedPrice: args.proposedPrice,
      phone: args.phone,
      recipientPhone: args.recipientPhone,
      parcelPhotoId: args.parcelPhotoId,
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

    if (parcel.parcelPhotoId) {
      await ctx.storage.delete(parcel.parcelPhotoId);
    }

    await ctx.db.patch(args.parcelId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });

    const pendingEscalations = await ctx.db
      .query("scheduledEscalations")
      .withIndex("by_parcel_status", (q) => q.eq("parcelId", args.parcelId).eq("status", "pending"))
      .collect();
    for (const escalation of pendingEscalations) {
      await ctx.db.patch(escalation._id, {
        status: "cancelled",
        updatedAt: Date.now(),
      });
    }
  },
});
