import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("parcels").order("desc").collect();
  },
});

export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const parcels = await ctx.db.query("parcels").order("desc").collect();
    return parcels.filter((p) => p.userId === args.userId);
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    userName: v.string(),
    origin: v.string(),
    destination: v.string(),
    size: v.union(
      v.literal("petit"),
      v.literal("moyen"),
      v.literal("grand")
    ),
    weight: v.number(),
    description: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("parcels", {
      ...args,
      status: "pending",
    });
  },
});
