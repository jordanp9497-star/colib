import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getForUser = query({
  args: { revieweeId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reviews")
      .withIndex("by_reviewee", (q) => q.eq("revieweeId", args.revieweeId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    reviewerId: v.string(),
    revieweeId: v.string(),
    tripId: v.optional(v.id("trips")),
    parcelId: v.optional(v.id("parcels")),
    rating: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.rating < 1 || args.rating > 5) {
      throw new Error("La note doit etre entre 1 et 5");
    }
    if (args.reviewerId === args.revieweeId) {
      throw new Error("Vous ne pouvez pas vous noter vous-meme");
    }

    await ctx.db.insert("reviews", {
      ...args,
      createdAt: Date.now(),
    });

    // Recalculer la note moyenne
    const allReviews = await ctx.db
      .query("reviews")
      .withIndex("by_reviewee", (q) => q.eq("revieweeId", args.revieweeId))
      .collect();

    const total = allReviews.reduce((sum, r) => sum + r.rating, 0);
    const avg = Math.round((total / allReviews.length) * 10) / 10;

    const user = await ctx.db
      .query("users")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.revieweeId))
      .first();
    if (user) {
      await ctx.db.patch(user._id, {
        averageRating: avg,
        totalReviews: allReviews.length,
      });
    }
  },
});
