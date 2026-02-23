import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("trips").order("desc").collect();
  },
});

export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const trips = await ctx.db.query("trips").order("desc").collect();
    return trips.filter((t) => t.userId === args.userId);
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    userName: v.string(),
    origin: v.string(),
    destination: v.string(),
    date: v.string(),
    availableSpace: v.union(
      v.literal("petit"),
      v.literal("moyen"),
      v.literal("grand")
    ),
    price: v.number(),
    description: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("trips", {
      ...args,
      status: "active",
    });
  },
});
