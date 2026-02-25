import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function evaluateCompliance(args: { idCardExpiresAt: number; carteGriseExpiresAt: number }) {
  const now = Date.now();
  const earliestExpiry = Math.min(args.idCardExpiresAt, args.carteGriseExpiresAt);

  if (earliestExpiry <= now) {
    return {
      status: "rejected" as const,
      riskLevel: "high" as const,
      requiresManualReview: true,
      reviewReason: "Document expire",
    };
  }

  if (earliestExpiry <= now + THIRTY_DAYS_MS) {
    return {
      status: "pending_review" as const,
      riskLevel: "medium" as const,
      requiresManualReview: true,
      reviewReason: "Document proche expiration (< 30 jours)",
    };
  }

  return {
    status: "approved" as const,
    riskLevel: "low" as const,
    requiresManualReview: false,
    reviewReason: undefined,
  };
}

export const getCarrierCompliance = query({
  args: {
    carrierVisitorId: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("carrierCompliance")
      .withIndex("by_carrier", (q) => q.eq("carrierVisitorId", args.carrierVisitorId))
      .first();

    if (!record) return null;

    const idCardUrl = record.idCardStorageId ? await ctx.storage.getUrl(record.idCardStorageId) : null;
    const carteGriseUrl = record.carteGriseStorageId
      ? await ctx.storage.getUrl(record.carteGriseStorageId)
      : null;

    return {
      ...record,
      idCardUrl,
      carteGriseUrl,
    };
  },
});

export const submitCarrierDocuments = mutation({
  args: {
    carrierVisitorId: v.string(),
    idCardStorageId: v.id("_storage"),
    carteGriseStorageId: v.id("_storage"),
    idCardExpiresAt: v.number(),
    carteGriseExpiresAt: v.number(),
    vehiclePlateNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const decision = evaluateCompliance(args);
    const existing = await ctx.db
      .query("carrierCompliance")
      .withIndex("by_carrier", (q) => q.eq("carrierVisitorId", args.carrierVisitorId))
      .first();

    const payload = {
      status: decision.status,
      riskLevel: decision.riskLevel,
      idCardStorageId: args.idCardStorageId,
      carteGriseStorageId: args.carteGriseStorageId,
      idCardExpiresAt: args.idCardExpiresAt,
      carteGriseExpiresAt: args.carteGriseExpiresAt,
      vehiclePlateNumber: args.vehiclePlateNumber.trim().toUpperCase(),
      reviewReason: decision.reviewReason,
      requiresManualReview: decision.requiresManualReview,
      reviewedByVisitorId: undefined,
      reviewedAt: undefined,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("carrierCompliance", {
        carrierVisitorId: args.carrierVisitorId,
        ...payload,
        createdAt: now,
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.carrierVisitorId))
      .first();

    if (user) {
      await ctx.db.patch(user._id, {
        idCardPhotoId: args.idCardStorageId,
        carteGrisePhotoId: args.carteGriseStorageId,
        identityVerified: decision.status === "approved" ? "verified" : decision.status === "rejected" ? "rejected" : "pending",
      });
    }

    return {
      status: decision.status,
      riskLevel: decision.riskLevel,
      requiresManualReview: decision.requiresManualReview,
      reviewReason: decision.reviewReason,
    };
  },
});

export const reviewCarrierCompliance = mutation({
  args: {
    carrierVisitorId: v.string(),
    reviewerVisitorId: v.string(),
    approve: v.boolean(),
    riskLevel: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    reviewReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("carrierCompliance")
      .withIndex("by_carrier", (q) => q.eq("carrierVisitorId", args.carrierVisitorId))
      .first();
    if (!record) {
      throw new Error("Dossier transporteur introuvable");
    }

    const now = Date.now();
    const nextStatus = args.approve ? "approved" : "rejected";
    await ctx.db.patch(record._id, {
      status: nextStatus,
      riskLevel: args.riskLevel,
      requiresManualReview: false,
      reviewReason: args.reviewReason,
      reviewedByVisitorId: args.reviewerVisitorId,
      reviewedAt: now,
      updatedAt: now,
    });

    const user = await ctx.db
      .query("users")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.carrierVisitorId))
      .first();
    if (user) {
      await ctx.db.patch(user._id, {
        identityVerified: nextStatus === "approved" ? "verified" : "rejected",
      });
    }

    return { success: true, status: nextStatus };
  },
});

export const listComplianceQueue = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending_review"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("suspended")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const status = args.status ?? "pending_review";
    const limit = Math.max(1, Math.min(args.limit ?? 50, 100));
    return await ctx.db
      .query("carrierCompliance")
      .withIndex("by_status_updated", (q) => q.eq("status", status))
      .order("desc")
      .take(limit);
  },
});

export const runComplianceExpirySweep = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allRecords = await ctx.db.query("carrierCompliance").collect();
    let suspended = 0;

    for (const record of allRecords) {
      const idExpired = record.idCardExpiresAt !== undefined && record.idCardExpiresAt <= now;
      const cgExpired = record.carteGriseExpiresAt !== undefined && record.carteGriseExpiresAt <= now;
      if (!idExpired && !cgExpired) continue;
      if (record.status === "suspended") continue;

      await ctx.db.patch(record._id, {
        status: "suspended",
        riskLevel: "high",
        requiresManualReview: true,
        reviewReason: "Suspension automatique: document expire",
        updatedAt: now,
      });
      suspended += 1;

      const user = await ctx.db
        .query("users")
        .withIndex("by_visitorId", (q) => q.eq("visitorId", record.carrierVisitorId))
        .first();
      if (user && user.identityVerified !== "rejected") {
        await ctx.db.patch(user._id, { identityVerified: "rejected" });
      }
    }

    return { suspended };
  },
});
