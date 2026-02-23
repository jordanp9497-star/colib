import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  trips: defineTable({
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
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
  }),
  parcels: defineTable({
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
    status: v.union(
      v.literal("pending"),
      v.literal("matched"),
      v.literal("delivered")
    ),
    tripId: v.optional(v.id("trips")),
  }),
});
