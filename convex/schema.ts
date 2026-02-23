import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const addressValidator = v.object({
  label: v.string(),
  city: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  countryCode: v.optional(v.string()),
  placeId: v.string(),
  lat: v.number(),
  lng: v.number(),
});

const parcelSize = v.union(v.literal("petit"), v.literal("moyen"), v.literal("grand"));

const tripStatus = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("matched"),
  v.literal("booked"),
  v.literal("completed"),
  v.literal("cancelled")
);

const parcelStatus = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("matched"),
  v.literal("booked"),
  v.literal("completed"),
  v.literal("cancelled")
);

const pricingBreakdown = v.object({
  currency: v.string(),
  baseAmount: v.number(),
  distanceAmount: v.number(),
  weightAmount: v.number(),
  volumeAmount: v.number(),
  detourAmount: v.number(),
  urgencyAmount: v.number(),
  fragileAmount: v.number(),
  insuranceAmount: v.number(),
  subtotal: v.number(),
  floorApplied: v.boolean(),
  ceilApplied: v.boolean(),
  totalAmount: v.number(),
  detourBracket: v.union(
    v.literal("0-5"),
    v.literal("6-10"),
    v.literal("11-20"),
    v.literal("21-30"),
    v.literal("30+")
  ),
});

export default defineSchema({
  trips: defineTable({
    ownerVisitorId: v.string(),
    userId: v.string(),
    userName: v.string(),
    origin: v.string(),
    destination: v.string(),
    originAddress: addressValidator,
    destinationAddress: addressValidator,
    routePolyline: v.optional(v.string()),
    routeDistanceKm: v.optional(v.number()),
    routeDurationMinutes: v.optional(v.number()),
    date: v.string(),
    windowStartTs: v.number(),
    windowEndTs: v.number(),
    availableSpace: parcelSize,
    maxWeightKg: v.number(),
    maxVolumeDm3: v.number(),
    price: v.number(),
    maxDetourMinutes: v.number(),
    description: v.optional(v.string()),
    phone: v.optional(v.string()),
    status: tripStatus,
    publishedAt: v.optional(v.number()),
    updatedAt: v.number(),
    createdAt: v.number(),
    approxZoneKey: v.string(),
  })
    .index("by_owner_status", ["ownerVisitorId", "status"])
    .index("by_status_windowStart", ["status", "windowStartTs"])
    .index("by_status_zone", ["status", "approxZoneKey"])
    .index("by_status_publishedAt", ["status", "publishedAt"]),

  parcels: defineTable({
    ownerVisitorId: v.string(),
    userId: v.string(),
    userName: v.string(),
    origin: v.string(),
    destination: v.string(),
    originAddress: addressValidator,
    destinationAddress: addressValidator,
    size: parcelSize,
    weight: v.number(),
    volumeDm3: v.number(),
    description: v.string(),
    fragile: v.boolean(),
    urgencyLevel: v.union(v.literal("normal"), v.literal("urgent"), v.literal("express")),
    insuranceValue: v.optional(v.number()),
    phone: v.optional(v.string()),
    status: parcelStatus,
    preferredWindowStartTs: v.number(),
    preferredWindowEndTs: v.number(),
    publishedAt: v.optional(v.number()),
    matchedTripId: v.optional(v.id("trips")),
    pricingEstimate: v.optional(pricingBreakdown),
    updatedAt: v.number(),
    createdAt: v.number(),
    approxZoneKey: v.string(),
  })
    .index("by_owner_status", ["ownerVisitorId", "status"])
    .index("by_status_windowStart", ["status", "preferredWindowStartTs"])
    .index("by_status_zone", ["status", "approxZoneKey"])
    .index("by_matched_trip", ["matchedTripId"]),

  matches: defineTable({
    tripId: v.id("trips"),
    parcelId: v.id("parcels"),
    status: v.union(
      v.literal("candidate"),
      v.literal("requested"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("expired"),
      v.literal("cancelled")
    ),
    score: v.number(),
    detourMinutes: v.number(),
    detourDistanceKm: v.number(),
    routeDistanceKm: v.number(),
    routeDurationMinutes: v.number(),
    pricingEstimate: pricingBreakdown,
    rankingReason: v.string(),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_trip", ["tripId"])
    .index("by_parcel", ["parcelId"])
    .index("by_trip_score", ["tripId", "score"])
    .index("by_parcel_score", ["parcelId", "score"])
    .index("by_status", ["status"]),

  mapsCache: defineTable({
    key: v.string(),
    namespace: v.string(),
    payload: v.any(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_expires", ["expiresAt"]),

  detourCache: defineTable({
    cacheKey: v.string(),
    tripId: v.id("trips"),
    parcelId: v.id("parcels"),
    detourMinutes: v.number(),
    detourDistanceKm: v.number(),
    routeDistanceKm: v.number(),
    routeDurationMinutes: v.number(),
    expiresAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_cache_key", ["cacheKey"])
    .index("by_trip", ["tripId"])
    .index("by_parcel", ["parcelId"]),

  users: defineTable({
    visitorId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    emailVerified: v.boolean(),
    phone: v.optional(v.string()),
    profilePhotoId: v.optional(v.id("_storage")),
    idCardPhotoId: v.optional(v.id("_storage")),
    carteGrisePhotoId: v.optional(v.id("_storage")),
    identityVerified: v.union(
      v.literal("none"),
      v.literal("pending"),
      v.literal("verified"),
      v.literal("rejected")
    ),
    averageRating: v.optional(v.number()),
    totalReviews: v.optional(v.number()),
    createdAt: v.string(),
  })
    .index("by_visitorId", ["visitorId"])
    .index("by_email", ["email"]),

  verificationCodes: defineTable({
    email: v.string(),
    code: v.string(),
    visitorId: v.string(),
    expiresAt: v.number(),
    used: v.boolean(),
  })
    .index("by_email_code", ["email", "code"])
    .index("by_visitorId", ["visitorId"]),

  reviews: defineTable({
    reviewerId: v.string(),
    revieweeId: v.string(),
    tripId: v.optional(v.id("trips")),
    parcelId: v.optional(v.id("parcels")),
    rating: v.number(),
    comment: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_reviewee", ["revieweeId"])
    .index("by_reviewer_trip", ["reviewerId", "tripId"]),
});
