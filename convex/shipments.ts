import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const shipmentStatusValidator = v.union(
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

const transitionMap: Record<string, string[]> = {
  carrier_assigned: ["en_route_pickup", "incident_open", "cancelled"],
  en_route_pickup: ["parcel_picked_up", "incident_open", "cancelled"],
  parcel_picked_up: ["in_transit", "incident_open"],
  in_transit: ["near_delivery", "incident_open"],
  near_delivery: ["delivered", "incident_open"],
  incident_open: ["incident_resolved", "cancelled"],
  incident_resolved: ["en_route_pickup", "in_transit", "near_delivery"],
  delivered: [],
  cancelled: [],
};

function ensureParticipant(shipment: { carrierVisitorId: string; customerVisitorId: string }, visitorId: string) {
  if (shipment.carrierVisitorId !== visitorId && shipment.customerVisitorId !== visitorId) {
    throw new Error("Non autorise");
  }
}

function getRole(shipment: { carrierVisitorId: string; customerVisitorId: string }, visitorId: string) {
  return shipment.carrierVisitorId === visitorId ? "carrier" : "customer";
}

function redactSensitiveContent(message: string) {
  const flags: string[] = [];
  let sanitized = message;

  if (/\b(?:\+?\d[\d\s.-]{7,}\d)\b/.test(sanitized)) {
    flags.push("phone");
    sanitized = sanitized.replace(/\b(?:\+?\d[\d\s.-]{7,}\d)\b/g, "[numero-masque]");
  }

  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(sanitized)) {
    flags.push("email");
    sanitized = sanitized.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email-masque]");
  }

  if (/https?:\/\//i.test(sanitized)) {
    flags.push("external_link");
    sanitized = sanitized.replace(/https?:\/\/\S+/gi, "[lien-masque]");
  }

  return {
    message: sanitized,
    flags,
  };
}

export const getById = query({
  args: {
    shipmentId: v.id("shipments"),
    requesterVisitorId: v.string(),
  },
  handler: async (ctx, args) => {
    const shipment = await ctx.db.get(args.shipmentId);
    if (!shipment) return null;
    ensureParticipant(shipment, args.requesterVisitorId);
    return shipment;
  },
});

export const getByMatchForUser = query({
  args: {
    matchId: v.id("matches"),
    requesterVisitorId: v.string(),
  },
  handler: async (ctx, args) => {
    const shipment = await ctx.db
      .query("shipments")
      .withIndex("by_match", (q) => q.eq("matchId", args.matchId))
      .first();
    if (!shipment) return null;
    ensureParticipant(shipment, args.requesterVisitorId);
    return shipment;
  },
});

export const listForUser = query({
  args: {
    requesterVisitorId: v.string(),
    role: v.optional(v.union(v.literal("carrier"), v.literal("customer"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 50, 100));
    if (args.role === "carrier") {
      return await ctx.db
        .query("shipments")
        .withIndex("by_carrier", (q) => q.eq("carrierVisitorId", args.requesterVisitorId))
        .order("desc")
        .take(limit);
    }

    if (args.role === "customer") {
      return await ctx.db
        .query("shipments")
        .withIndex("by_customer", (q) => q.eq("customerVisitorId", args.requesterVisitorId))
        .order("desc")
        .take(limit);
    }

    const [asCarrier, asCustomer] = await Promise.all([
      ctx.db
        .query("shipments")
        .withIndex("by_carrier", (q) => q.eq("carrierVisitorId", args.requesterVisitorId))
        .order("desc")
        .take(limit),
      ctx.db
        .query("shipments")
        .withIndex("by_customer", (q) => q.eq("customerVisitorId", args.requesterVisitorId))
        .order("desc")
        .take(limit),
    ]);

    return [...asCarrier, ...asCustomer]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  },
});

export const getTimeline = query({
  args: {
    shipmentId: v.id("shipments"),
    requesterVisitorId: v.string(),
  },
  handler: async (ctx, args) => {
    const shipment = await ctx.db.get(args.shipmentId);
    if (!shipment) return null;
    ensureParticipant(shipment, args.requesterVisitorId);

    const events = await ctx.db
      .query("shipmentEvents")
      .withIndex("by_shipment_created", (q) => q.eq("shipmentId", args.shipmentId))
      .order("asc")
      .collect();

    return {
      shipment,
      events,
    };
  },
});

export const pushTrackingPoint = mutation({
  args: {
    shipmentId: v.id("shipments"),
    carrierVisitorId: v.string(),
    lat: v.number(),
    lng: v.number(),
    speedKmh: v.optional(v.number()),
    heading: v.optional(v.number()),
    accuracyMeters: v.optional(v.number()),
    recordedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const shipment = await ctx.db.get(args.shipmentId);
    if (!shipment) throw new Error("Transport introuvable");
    if (shipment.carrierVisitorId !== args.carrierVisitorId) {
      throw new Error("Seul le transporteur assigne peut envoyer le tracking");
    }
    if (
      shipment.status !== "en_route_pickup" &&
      shipment.status !== "parcel_picked_up" &&
      shipment.status !== "in_transit" &&
      shipment.status !== "near_delivery"
    ) {
      throw new Error("Tracking indisponible pour ce statut");
    }

    const now = Date.now();
    const recordedAt = args.recordedAt ?? now;
    await ctx.db.insert("shipmentTrackingPoints", {
      shipmentId: args.shipmentId,
      carrierVisitorId: args.carrierVisitorId,
      lat: args.lat,
      lng: args.lng,
      speedKmh: args.speedKmh,
      heading: args.heading,
      accuracyMeters: args.accuracyMeters,
      recordedAt,
      createdAt: now,
    });

    await ctx.db.patch(args.shipmentId, {
      lastTrackingAt: recordedAt,
      updatedAt: now,
    });

    return { success: true, recordedAt };
  },
});

export const getLiveTracking = query({
  args: {
    shipmentId: v.id("shipments"),
    requesterVisitorId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const shipment = await ctx.db.get(args.shipmentId);
    if (!shipment) return null;
    ensureParticipant(shipment, args.requesterVisitorId);

    const limit = Math.max(1, Math.min(args.limit ?? 100, 300));
    const points = await ctx.db
      .query("shipmentTrackingPoints")
      .withIndex("by_shipment_recorded", (q) => q.eq("shipmentId", args.shipmentId))
      .order("desc")
      .take(limit);

    return {
      shipmentId: args.shipmentId,
      latest: points[0] ?? null,
      points,
    };
  },
});

export const updateStatus = mutation({
  args: {
    shipmentId: v.id("shipments"),
    actorVisitorId: v.string(),
    nextStatus: shipmentStatusValidator,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const shipment = await ctx.db.get(args.shipmentId);
    if (!shipment) throw new Error("Transport introuvable");
    ensureParticipant(shipment, args.actorVisitorId);

    const role = getRole(shipment, args.actorVisitorId);
    const current = shipment.status;
    if (current === args.nextStatus) {
      return { success: true, status: current };
    }

    const allowed = transitionMap[current] ?? [];
    if (!allowed.includes(args.nextStatus)) {
      throw new Error(`Transition invalide: ${current} -> ${args.nextStatus}`);
    }

    if (
      (args.nextStatus === "en_route_pickup" ||
        args.nextStatus === "parcel_picked_up" ||
        args.nextStatus === "in_transit" ||
        args.nextStatus === "near_delivery") &&
      role !== "carrier"
    ) {
      throw new Error("Seul le transporteur peut mettre a jour ce statut");
    }

    if (args.nextStatus === "delivered" && role !== "customer" && role !== "carrier") {
      throw new Error("Statut de livraison non autorise");
    }

    const now = Date.now();
    await ctx.db.patch(args.shipmentId, {
      status: args.nextStatus,
      deliveredAt: args.nextStatus === "delivered" ? now : shipment.deliveredAt,
      updatedAt: now,
    });

    await ctx.db.insert("shipmentEvents", {
      shipmentId: args.shipmentId,
      eventType: "status_changed",
      actorVisitorId: args.actorVisitorId,
      fromStatus: current,
      toStatus: args.nextStatus,
      payload: args.note ? { note: args.note } : undefined,
      createdAt: now,
    });

    return { success: true, status: args.nextStatus };
  },
});

export const sendMessage = mutation({
  args: {
    shipmentId: v.id("shipments"),
    senderVisitorId: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const shipment = await ctx.db.get(args.shipmentId);
    if (!shipment) throw new Error("Transport introuvable");
    ensureParticipant(shipment, args.senderVisitorId);

    const trimmed = args.body.trim();
    if (!trimmed) {
      throw new Error("Message vide");
    }
    if (trimmed.length > 2000) {
      throw new Error("Message trop long");
    }

    const moderated = redactSensitiveContent(trimmed);
    const now = Date.now();

    const senderRole = getRole(shipment, args.senderVisitorId);
    const messageId = await ctx.db.insert("shipmentMessages", {
      shipmentId: args.shipmentId,
      senderVisitorId: args.senderVisitorId,
      senderRole,
      body: moderated.message,
      moderationFlags: moderated.flags,
      createdAt: now,
      readAt: undefined,
    });

    await ctx.db.insert("shipmentEvents", {
      shipmentId: args.shipmentId,
      eventType: "message_sent",
      actorVisitorId: args.senderVisitorId,
      fromStatus: undefined,
      toStatus: undefined,
      payload: {
        messageId,
        moderationFlags: moderated.flags,
      },
      createdAt: now,
    });

    return {
      success: true,
      messageId,
      moderationFlags: moderated.flags,
    };
  },
});

export const listMessages = query({
  args: {
    shipmentId: v.id("shipments"),
    requesterVisitorId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const shipment = await ctx.db.get(args.shipmentId);
    if (!shipment) return [];
    ensureParticipant(shipment, args.requesterVisitorId);

    const limit = Math.max(1, Math.min(args.limit ?? 100, 300));
    return await ctx.db
      .query("shipmentMessages")
      .withIndex("by_shipment_created", (q) => q.eq("shipmentId", args.shipmentId))
      .order("asc")
      .take(limit);
  },
});

export const openIncident = mutation({
  args: {
    shipmentId: v.id("shipments"),
    actorVisitorId: v.string(),
    type: v.union(
      v.literal("delay"),
      v.literal("pickup_failed"),
      v.literal("delivery_failed"),
      v.literal("damage"),
      v.literal("lost"),
      v.literal("other")
    ),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const shipment = await ctx.db.get(args.shipmentId);
    if (!shipment) throw new Error("Transport introuvable");
    ensureParticipant(shipment, args.actorVisitorId);

    const now = Date.now();
    const incidentId = await ctx.db.insert("shipmentIncidents", {
      shipmentId: args.shipmentId,
      openedByVisitorId: args.actorVisitorId,
      type: args.type,
      severity: args.severity,
      status: "open",
      description: args.description,
      resolutionNote: undefined,
      openedAt: now,
      closedAt: undefined,
      updatedAt: now,
    });

    const previousStatus = shipment.status;
    if (shipment.status !== "incident_open") {
      await ctx.db.patch(args.shipmentId, {
        status: "incident_open",
        updatedAt: now,
      });
    }

    await ctx.db.insert("shipmentEvents", {
      shipmentId: args.shipmentId,
      eventType: "incident_opened",
      actorVisitorId: args.actorVisitorId,
      fromStatus: previousStatus,
      toStatus: "incident_open",
      payload: { incidentId, type: args.type, severity: args.severity },
      createdAt: now,
    });

    return { success: true, incidentId };
  },
});

export const resolveIncident = mutation({
  args: {
    incidentId: v.id("shipmentIncidents"),
    actorVisitorId: v.string(),
    resolutionNote: v.optional(v.string()),
    resumeStatus: v.optional(
      v.union(v.literal("en_route_pickup"), v.literal("in_transit"), v.literal("near_delivery"), v.literal("cancelled"))
    ),
  },
  handler: async (ctx, args) => {
    const incident = await ctx.db.get(args.incidentId);
    if (!incident) throw new Error("Incident introuvable");
    if (incident.status === "resolved") return { success: true };

    const shipment = await ctx.db.get(incident.shipmentId);
    if (!shipment) throw new Error("Transport introuvable");
    ensureParticipant(shipment, args.actorVisitorId);

    const now = Date.now();
    await ctx.db.patch(incident._id, {
      status: "resolved",
      resolutionNote: args.resolutionNote,
      closedAt: now,
      updatedAt: now,
    });

    const nextStatus = args.resumeStatus ?? "incident_resolved";
    await ctx.db.patch(shipment._id, {
      status: nextStatus,
      updatedAt: now,
    });

    await ctx.db.insert("shipmentEvents", {
      shipmentId: shipment._id,
      eventType: "incident_resolved",
      actorVisitorId: args.actorVisitorId,
      fromStatus: shipment.status,
      toStatus: nextStatus,
      payload: {
        incidentId: incident._id,
        resolutionNote: args.resolutionNote,
      },
      createdAt: now,
    });

    return { success: true };
  },
});
