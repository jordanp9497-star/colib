import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function normalizePhone(phone?: string) {
  if (!phone) return undefined;
  const cleaned = phone.trim().replace(/\s+/g, " ");
  return cleaned.length ? cleaned : undefined;
}

function assertValidName(name: string) {
  if (name.length < 2 || name.length > 80) {
    throw new Error("Nom invalide");
  }
}

function assertValidPhone(phone?: string) {
  if (!phone) return;
  if (!/^\+?[0-9()\-\s]{6,20}$/.test(phone)) {
    throw new Error("Telephone invalide");
  }
}

export const getByVisitorId = query({
  args: { visitorId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.visitorId))
      .first();
    if (!user) return null;
    const profilePhotoUrl = user.profilePhotoId
      ? await ctx.storage.getUrl(user.profilePhotoId)
      : null;
    return { ...user, profilePhotoUrl };
  },
});

export const getPublicProfile = query({
  args: { visitorId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.visitorId))
      .first();
    if (!user) return null;
    const profilePhotoUrl = user.profilePhotoId
      ? await ctx.storage.getUrl(user.profilePhotoId)
      : null;
    return {
      name: user.name,
      profilePhotoUrl,
      averageRating: user.averageRating ?? null,
      totalReviews: user.totalReviews ?? 0,
      identityVerified: user.identityVerified,
      emailVerified: user.emailVerified,
    };
  },
});

export const createOrUpdate = mutation({
  args: {
    visitorId: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedName = normalizeName(args.name);
    const normalizedPhone = normalizePhone(args.phone);
    assertValidName(normalizedName);
    assertValidPhone(normalizedPhone);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.visitorId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: normalizedName,
        phone: normalizedPhone,
      });
      return existing._id;
    }
    return await ctx.db.insert("users", {
      visitorId: args.visitorId,
      name: normalizedName,
      phone: normalizedPhone,
      emailVerified: false,
      identityVerified: "none",
      createdAt: new Date().toISOString(),
    });
  },
});

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveProfilePhoto = mutation({
  args: {
    visitorId: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.visitorId))
      .first();
    if (!user) throw new Error("Utilisateur introuvable");
    if (user.profilePhotoId) {
      await ctx.storage.delete(user.profilePhotoId);
    }
    await ctx.db.patch(user._id, { profilePhotoId: args.storageId });
  },
});

export const saveIdentityDocuments = mutation({
  args: {
    visitorId: v.string(),
    idCardPhotoId: v.id("_storage"),
    carteGrisePhotoId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.visitorId))
      .first();
    if (!user) throw new Error("Utilisateur introuvable");
    await ctx.db.patch(user._id, {
      idCardPhotoId: args.idCardPhotoId,
      carteGrisePhotoId: args.carteGrisePhotoId,
      identityVerified: "pending",
    });
  },
});

export const updateName = mutation({
  args: {
    visitorId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.visitorId))
      .first();
    if (!user) throw new Error("Utilisateur introuvable");
    await ctx.db.patch(user._id, { name: args.name });
  },
});
