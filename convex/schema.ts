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

const complianceStatus = v.union(
  v.literal("not_submitted"),
  v.literal("pending_review"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("suspended")
);

const riskLevel = v.union(v.literal("low"), v.literal("medium"), v.literal("high"));

const shipmentStatus = v.union(
  v.literal("carrier_assigned"),
  v.literal("en_route_pickup"),
  v.literal("parcel_picked_up"),
  v.literal("in_transit"),
  v.literal("near_delivery"),
  v.literal("delivered"),
  v.literal("incident_open"),
  v.literal("incident_resolved"),
  v.literal("cancelled")
);

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

  notifications: defineTable({
    recipientVisitorId: v.string(),
    actorVisitorId: v.optional(v.string()),
    type: v.union(
      v.literal("reservation_request"),
      v.literal("reservation_accepted"),
      v.literal("payment_required"),
      v.literal("new_match_for_trip"),
      v.literal("trip_session_matches")
    ),
    title: v.string(),
    message: v.string(),
    matchId: v.optional(v.id("matches")),
    tripId: v.optional(v.id("trips")),
    parcelId: v.optional(v.id("parcels")),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_recipient_createdAt", ["recipientVisitorId", "createdAt"])
    .index("by_recipient_readAt", ["recipientVisitorId", "readAt"]),

  tripSessions: defineTable({
    userId: v.string(),
    origin: addressValidator,
    destination: addressValidator,
    deviationMaxMinutes: v.union(v.literal(5), v.literal(10), v.literal(20), v.literal(30)),
    opportunitiesEnabled: v.boolean(),
    status: v.union(v.literal("ACTIVE"), v.literal("STOPPED"), v.literal("EXPIRED")),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    lastLocation: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
        timestamp: v.number(),
      })
    ),
    lastNotifiedAt: v.optional(v.number()),
    matchesCountCache: v.number(),
    updatedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_user_startedAt", ["userId", "startedAt"])
    .index("by_status_updated", ["status", "updatedAt"]),

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

  carrierCompliance: defineTable({
    carrierVisitorId: v.string(),
    status: complianceStatus,
    riskLevel: riskLevel,
    idCardStorageId: v.optional(v.id("_storage")),
    carteGriseStorageId: v.optional(v.id("_storage")),
    idCardExpiresAt: v.optional(v.number()),
    carteGriseExpiresAt: v.optional(v.number()),
    vehiclePlateNumber: v.optional(v.string()),
    reviewReason: v.optional(v.string()),
    requiresManualReview: v.boolean(),
    reviewedByVisitorId: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    updatedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_carrier", ["carrierVisitorId"])
    .index("by_status", ["status"])
    .index("by_status_updated", ["status", "updatedAt"]),

  shipments: defineTable({
    matchId: v.id("matches"),
    tripId: v.id("trips"),
    parcelId: v.id("parcels"),
    carrierVisitorId: v.string(),
    customerVisitorId: v.string(),
    status: shipmentStatus,
    insuranceEligible: v.boolean(),
    insuranceBlockedReason: v.optional(v.string()),
    lastTrackingAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_match", ["matchId"])
    .index("by_trip", ["tripId"])
    .index("by_parcel", ["parcelId"])
    .index("by_carrier", ["carrierVisitorId"])
    .index("by_customer", ["customerVisitorId"])
    .index("by_status_updated", ["status", "updatedAt"]),

  shipmentEvents: defineTable({
    shipmentId: v.id("shipments"),
    eventType: v.string(),
    actorVisitorId: v.optional(v.string()),
    fromStatus: v.optional(shipmentStatus),
    toStatus: v.optional(shipmentStatus),
    payload: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_shipment_created", ["shipmentId", "createdAt"]),

  shipmentTrackingPoints: defineTable({
    shipmentId: v.id("shipments"),
    carrierVisitorId: v.string(),
    lat: v.number(),
    lng: v.number(),
    speedKmh: v.optional(v.number()),
    heading: v.optional(v.number()),
    accuracyMeters: v.optional(v.number()),
    recordedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_shipment_recorded", ["shipmentId", "recordedAt"]),

  shipmentMessages: defineTable({
    shipmentId: v.id("shipments"),
    senderVisitorId: v.string(),
    senderRole: v.union(v.literal("carrier"), v.literal("customer"), v.literal("system")),
    body: v.string(),
    moderationFlags: v.array(v.string()),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
  })
    .index("by_shipment_created", ["shipmentId", "createdAt"]),

  shipmentIncidents: defineTable({
    shipmentId: v.id("shipments"),
    openedByVisitorId: v.string(),
    type: v.union(
      v.literal("delay"),
      v.literal("pickup_failed"),
      v.literal("delivery_failed"),
      v.literal("damage"),
      v.literal("lost"),
      v.literal("other")
    ),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    status: v.union(v.literal("open"), v.literal("resolved")),
    description: v.optional(v.string()),
    resolutionNote: v.optional(v.string()),
    openedAt: v.number(),
    closedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_shipment", ["shipmentId"])
    .index("by_status", ["status"]),

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
