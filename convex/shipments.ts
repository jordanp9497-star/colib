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

const shipmentPaymentStatusValidator = v.union(
  v.literal("pending"),
  v.literal("held"),
  v.literal("release_pending"),
  v.literal("released"),
  v.literal("failed")
);

const transitionMap: Record<string, string[]> = {
  carrier_assigned: ["en_route_pickup", "incident_open", "cancelled"],
  en_route_pickup: ["parcel_picked_up", "incident_open", "cancelled"],
  parcel_picked_up: ["in_transit", "incident_open"],
  in_transit: ["near_delivery", "incident_open"],
  near_delivery: ["incident_open"],
  incident_open: ["incident_resolved", "cancelled"],
  incident_resolved: ["en_route_pickup", "in_transit", "near_delivery"],
  delivered: [],
  cancelled: [],
};

const DELIVERY_QR_SMS =
  "Votre colis est pris en charge par un Colib ! veuillez faire scanner ce QR code au transporteur des que vous recevez votre colis";
const BETA_ADMIN_NAME = "jordan";

function createToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}-${Math.random().toString(36).slice(2, 11)}`;
}

function hashToken(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `h_${(hash >>> 0).toString(16)}`;
}

function ensureParticipant(shipment: { carrierVisitorId: string; customerVisitorId: string }, visitorId: string) {
  if (shipment.carrierVisitorId !== visitorId && shipment.customerVisitorId !== visitorId) {
    throw new Error("Non autorise");
  }
}

function getRole(shipment: { carrierVisitorId: string; customerVisitorId: string }, visitorId: string) {
  return shipment.carrierVisitorId === visitorId ? "carrier" : "customer";
}

async function assertJordanAdminOrThrow(ctx: { db: any }, adminVisitorId: string) {
  const adminUser = await ctx.db
    .query("users")
    .withIndex("by_visitorId", (q: any) => q.eq("visitorId", adminVisitorId))
    .first();
  if (!adminUser) {
    throw new Error("Profil admin introuvable");
  }

  const normalized = adminUser.name.trim().toLowerCase();
  if (normalized !== BETA_ADMIN_NAME) {
    throw new Error("Acces reserve a Jordan (BETA)");
  }

  return adminUser;
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

export const getPaymentAndDeliveryState = query({
  args: {
    shipmentId: v.id("shipments"),
    requesterVisitorId: v.string(),
  },
  handler: async (ctx, args) => {
    const shipment = await ctx.db.get(args.shipmentId);
    if (!shipment) return null;
    ensureParticipant(shipment, args.requesterVisitorId);

    const latestVerification = (
      await ctx.db
        .query("shipmentDeliveryVerifications")
        .withIndex("by_shipment", (q) => q.eq("shipmentId", args.shipmentId))
        .order("desc")
        .take(1)
    )[0];

    const role = getRole(shipment, args.requesterVisitorId);
    return {
      role,
      paymentStatus: shipment.paymentStatus,
      paymentAmount: shipment.paymentAmount,
      paymentCurrency: shipment.paymentCurrency,
      paymentHeldAt: shipment.paymentHeldAt,
      paymentReleasedAt: shipment.paymentReleasedAt,
      canPay: role === "customer" && shipment.paymentStatus === "pending" && shipment.status !== "cancelled",
      canScanQr:
        role === "carrier" &&
        shipment.paymentStatus === "held" &&
        shipment.status === "near_delivery" &&
        Boolean(latestVerification) &&
        !latestVerification.scannedAt,
      verification: latestVerification
        ? {
            recipientPhone: latestVerification.recipientPhone,
            qrPayload: role === "customer" ? latestVerification.qrPayload : undefined,
            smsStatus: latestVerification.smsStatus,
            expiresAt: latestVerification.expiresAt,
            scannedAt: latestVerification.scannedAt,
          }
        : null,
    };
  },
});

export const confirmPaymentHold = mutation({
  args: {
    shipmentId: v.id("shipments"),
    actorVisitorId: v.string(),
    paymentProvider: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const shipment = await ctx.db.get(args.shipmentId);
    if (!shipment) throw new Error("Transport introuvable");
    ensureParticipant(shipment, args.actorVisitorId);
    if (shipment.customerVisitorId !== args.actorVisitorId) {
      throw new Error("Seul le posteur peut effectuer le paiement");
    }
    if (shipment.status === "cancelled") {
      throw new Error("Paiement impossible sur un transport annule");
    }
    if (shipment.paymentStatus === "held" || shipment.paymentStatus === "released") {
      return { success: true, paymentStatus: shipment.paymentStatus };
    }

    const parcel = await ctx.db.get(shipment.parcelId);
    if (!parcel?.recipientPhone) {
      throw new Error("Numero destinataire manquant. Mettez a jour le colis avant paiement.");
    }

    const now = Date.now();
    const rawToken = createToken();
    const qrTokenHash = hashToken(rawToken);
    const qrPayload = `COLIB-DELIVERY:${rawToken}`;
    const expiresAt = now + 1000 * 60 * 60 * 72;
    const smsBody = `${DELIVERY_QR_SMS}\n\nQR: ${qrPayload}`;

    await ctx.db.patch(shipment._id, {
      paymentStatus: "held",
      paymentProvider: args.paymentProvider ?? "colib_escrow_simulated",
      paymentReference: args.paymentReference ?? `sim_${rawToken.slice(0, 12)}`,
      paymentHeldAt: now,
      updatedAt: now,
    });

    const verificationId = await ctx.db.insert("shipmentDeliveryVerifications", {
      shipmentId: shipment._id,
      recipientPhone: parcel.recipientPhone,
      qrTokenHash,
      qrPayload,
      smsMessage: smsBody,
      smsStatus: "sent",
      smsProviderMessageId: `mock_sms_${rawToken.slice(0, 10)}`,
      expiresAt,
      scannedAt: undefined,
      scannedByVisitorId: undefined,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("outboundMessages", {
      channel: "sms",
      recipient: parcel.recipientPhone,
      body: smsBody,
      template: "delivery_qr",
      status: "sent",
      provider: "mock_sms",
      providerMessageId: `mock_sms_${rawToken.slice(0, 10)}`,
      errorMessage: undefined,
      metadata: { shipmentId: shipment._id, verificationId },
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("shipmentEvents", {
      shipmentId: shipment._id,
      eventType: "payment_held",
      actorVisitorId: args.actorVisitorId,
      fromStatus: shipment.status,
      toStatus: shipment.status,
      payload: {
        amount: shipment.paymentAmount,
        currency: shipment.paymentCurrency,
        paymentProvider: args.paymentProvider ?? "colib_escrow_simulated",
      },
      createdAt: now,
    });

    await ctx.db.insert("shipmentEvents", {
      shipmentId: shipment._id,
      eventType: "delivery_qr_sent",
      actorVisitorId: args.actorVisitorId,
      fromStatus: shipment.status,
      toStatus: shipment.status,
      payload: {
        recipientPhone: parcel.recipientPhone,
        expiresAt,
      },
      createdAt: now,
    });

    await ctx.db.insert("notifications", {
      recipientVisitorId: shipment.customerVisitorId,
      actorVisitorId: shipment.carrierVisitorId,
      type: "delivery_qr_sent",
      title: "QR destinataire envoye",
      message: "Le SMS de validation a ete envoye au destinataire. Le paiement reste bloque jusqu au scan.",
      matchId: shipment.matchId,
      tripId: shipment.tripId,
      parcelId: shipment.parcelId,
      readAt: undefined,
      createdAt: now,
    });

    return {
      success: true,
      paymentStatus: "held" as const,
      qrPayload,
      expiresAt,
    };
  },
});

export const scanDeliveryQrAndReleasePayment = mutation({
  args: {
    shipmentId: v.id("shipments"),
    actorVisitorId: v.string(),
    qrPayload: v.string(),
  },
  handler: async (ctx, args) => {
    const shipment = await ctx.db.get(args.shipmentId);
    if (!shipment) throw new Error("Transport introuvable");
    ensureParticipant(shipment, args.actorVisitorId);
    if (shipment.carrierVisitorId !== args.actorVisitorId) {
      throw new Error("Seul le transporteur assigne peut scanner ce QR");
    }
    if (shipment.status !== "near_delivery") {
      throw new Error("Le scan QR est disponible uniquement a l etape de remise");
    }
    if (shipment.paymentStatus !== "held" && shipment.paymentStatus !== "release_pending") {
      throw new Error("Le paiement n est pas bloque, scan impossible");
    }

    const now = Date.now();
    const expectedHash = hashToken(args.qrPayload.trim());
    const candidates = await ctx.db
      .query("shipmentDeliveryVerifications")
      .withIndex("by_shipment", (q) => q.eq("shipmentId", shipment._id))
      .order("desc")
      .take(5);
    const verification = candidates.find(
      (entry) => entry.qrTokenHash === expectedHash && !entry.scannedAt && entry.expiresAt > now
    );

    if (!verification) {
      throw new Error("QR invalide, expire ou deja utilise");
    }

    await ctx.db.patch(verification._id, {
      scannedAt: now,
      scannedByVisitorId: args.actorVisitorId,
      updatedAt: now,
    });

    await ctx.db.patch(shipment._id, {
      status: "delivered",
      deliveredAt: now,
      paymentStatus: "released",
      paymentReleasedAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("shipmentEvents", {
      shipmentId: shipment._id,
      eventType: "delivery_qr_scanned",
      actorVisitorId: args.actorVisitorId,
      fromStatus: "near_delivery",
      toStatus: "delivered",
      payload: {
        verificationId: verification._id,
      },
      createdAt: now,
    });

    await ctx.db.insert("shipmentEvents", {
      shipmentId: shipment._id,
      eventType: "payment_released",
      actorVisitorId: args.actorVisitorId,
      fromStatus: "near_delivery",
      toStatus: "delivered",
      payload: {
        amount: shipment.paymentAmount,
        currency: shipment.paymentCurrency,
      },
      createdAt: now,
    });

    await ctx.db.insert("notifications", {
      recipientVisitorId: shipment.customerVisitorId,
      actorVisitorId: shipment.carrierVisitorId,
      type: "payment_released",
      title: "Paiement libere",
      message: "Le QR de remise a ete valide. Le paiement transporteur est maintenant libere.",
      matchId: shipment.matchId,
      tripId: shipment.tripId,
      parcelId: shipment.parcelId,
      readAt: undefined,
      createdAt: now,
    });

    await ctx.db.insert("notifications", {
      recipientVisitorId: shipment.carrierVisitorId,
      actorVisitorId: shipment.customerVisitorId,
      type: "delivery_qr_scanned",
      title: "Remise validee",
      message: "QR valide avec succes. Le statut de livraison et le paiement ont ete finalises.",
      matchId: shipment.matchId,
      tripId: shipment.tripId,
      parcelId: shipment.parcelId,
      readAt: undefined,
      createdAt: now,
    });

    return { success: true, status: "delivered", paymentStatus: "released" as const };
  },
});

export const syncPaymentStatusFromProvider = mutation({
  args: {
    shipmentId: v.id("shipments"),
    paymentStatus: shipmentPaymentStatusValidator,
    paymentReference: v.optional(v.string()),
    actorVisitorId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const shipment = await ctx.db.get(args.shipmentId);
    if (!shipment) throw new Error("Transport introuvable");

    const now = Date.now();
    await ctx.db.patch(shipment._id, {
      paymentStatus: args.paymentStatus,
      paymentReference: args.paymentReference ?? shipment.paymentReference,
      paymentHeldAt: args.paymentStatus === "held" ? (shipment.paymentHeldAt ?? now) : shipment.paymentHeldAt,
      paymentReleasedAt: args.paymentStatus === "released" ? (shipment.paymentReleasedAt ?? now) : shipment.paymentReleasedAt,
      updatedAt: now,
    });

    await ctx.db.insert("shipmentEvents", {
      shipmentId: shipment._id,
      eventType: "payment_provider_sync",
      actorVisitorId: args.actorVisitorId,
      fromStatus: shipment.status,
      toStatus: shipment.status,
      payload: {
        paymentStatus: args.paymentStatus,
        paymentReference: args.paymentReference,
      },
      createdAt: now,
    });

    return { success: true };
  },
});

export const adminListSupportQueue = query({
  args: {
    adminVisitorId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertJordanAdminOrThrow(ctx, args.adminVisitorId);

    const limit = Math.max(5, Math.min(args.limit ?? 50, 120));
    const shipments = await ctx.db
      .query("shipments")
      .withIndex("by_status_updated", (q) => q)
      .order("desc")
      .take(limit);

    const enriched = [];
    for (const shipment of shipments) {
      const parcel = await ctx.db.get(shipment.parcelId);
      const latestVerification = (
        await ctx.db
          .query("shipmentDeliveryVerifications")
          .withIndex("by_shipment", (q) => q.eq("shipmentId", shipment._id))
          .order("desc")
          .take(1)
      )[0];

      const incidents = await ctx.db
        .query("shipmentIncidents")
        .withIndex("by_shipment", (q) => q.eq("shipmentId", shipment._id))
        .collect();
      const openIncident = incidents.find((incident) => incident.status === "open") ?? null;

      const needsSupport =
        shipment.status === "incident_open" ||
        shipment.paymentStatus !== "released" ||
        Boolean(openIncident) ||
        (latestVerification ? !latestVerification.scannedAt && latestVerification.expiresAt < Date.now() : false);

      if (!needsSupport) continue;

      enriched.push({
        shipment,
        parcel: parcel
          ? {
              origin: parcel.origin,
              destination: parcel.destination,
              recipientPhone: parcel.recipientPhone,
            }
          : null,
        verification: latestVerification
          ? {
              smsStatus: latestVerification.smsStatus,
              expiresAt: latestVerification.expiresAt,
              scannedAt: latestVerification.scannedAt,
            }
          : null,
        openIncident: openIncident
          ? {
              type: openIncident.type,
              severity: openIncident.severity,
              openedAt: openIncident.openedAt,
            }
          : null,
      });
    }

    return enriched;
  },
});

export const adminResendDeliveryQr = mutation({
  args: {
    adminVisitorId: v.string(),
    shipmentId: v.id("shipments"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertJordanAdminOrThrow(ctx, args.adminVisitorId);

    const shipment = await ctx.db.get(args.shipmentId);
    if (!shipment) throw new Error("Transport introuvable");
    const parcel = await ctx.db.get(shipment.parcelId);
    if (!parcel?.recipientPhone) {
      throw new Error("Numero destinataire manquant");
    }
    if (shipment.paymentStatus !== "held" && shipment.paymentStatus !== "release_pending") {
      throw new Error("Le QR n est utile que pour un paiement bloque");
    }

    const now = Date.now();
    const pendingVerifications = await ctx.db
      .query("shipmentDeliveryVerifications")
      .withIndex("by_shipment", (q) => q.eq("shipmentId", shipment._id))
      .order("desc")
      .take(10);
    for (const verification of pendingVerifications) {
      if (!verification.scannedAt && verification.expiresAt > now) {
        await ctx.db.patch(verification._id, {
          expiresAt: now - 1000,
          updatedAt: now,
        });
      }
    }

    const rawToken = createToken();
    const qrPayload = `COLIB-DELIVERY:${rawToken}`;
    const qrTokenHash = hashToken(qrPayload);
    const expiresAt = now + 1000 * 60 * 60 * 72;
    const smsBody = `${DELIVERY_QR_SMS}\n\nQR: ${qrPayload}`;

    await ctx.db.insert("shipmentDeliveryVerifications", {
      shipmentId: shipment._id,
      recipientPhone: parcel.recipientPhone,
      qrTokenHash,
      qrPayload,
      smsMessage: smsBody,
      smsStatus: "queued",
      smsProviderMessageId: undefined,
      expiresAt,
      scannedAt: undefined,
      scannedByVisitorId: undefined,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("outboundMessages", {
      channel: "sms",
      recipient: parcel.recipientPhone,
      body: smsBody,
      template: "delivery_qr",
      status: "queued",
      provider: "beta_placeholder",
      providerMessageId: undefined,
      errorMessage: undefined,
      metadata: { shipmentId: shipment._id, reason: args.reason ?? "admin_resend" },
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("shipmentEvents", {
      shipmentId: shipment._id,
      eventType: "admin_qr_resent",
      actorVisitorId: args.adminVisitorId,
      fromStatus: shipment.status,
      toStatus: shipment.status,
      payload: {
        reason: args.reason ?? "Support BETA",
      },
      createdAt: now,
    });

    return { success: true, qrPayload, expiresAt };
  },
});

export const adminForceReleasePayment = mutation({
  args: {
    adminVisitorId: v.string(),
    shipmentId: v.id("shipments"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertJordanAdminOrThrow(ctx, args.adminVisitorId);

    const shipment = await ctx.db.get(args.shipmentId);
    if (!shipment) throw new Error("Transport introuvable");
    if (shipment.paymentStatus === "released") {
      return { success: true, paymentStatus: "released" as const };
    }

    const now = Date.now();
    await ctx.db.patch(shipment._id, {
      paymentStatus: "released",
      paymentReleasedAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("shipmentEvents", {
      shipmentId: shipment._id,
      eventType: "admin_payment_released",
      actorVisitorId: args.adminVisitorId,
      fromStatus: shipment.status,
      toStatus: shipment.status,
      payload: {
        reason: args.reason ?? "Support BETA",
      },
      createdAt: now,
    });

    await ctx.db.insert("notifications", {
      recipientVisitorId: shipment.customerVisitorId,
      actorVisitorId: args.adminVisitorId,
      type: "payment_released",
      title: "Paiement libere (support BETA)",
      message: "Le support Colib a libere le paiement apres verification manuelle.",
      matchId: shipment.matchId,
      tripId: shipment.tripId,
      parcelId: shipment.parcelId,
      readAt: undefined,
      createdAt: now,
    });

    return { success: true, paymentStatus: "released" as const };
  },
});

export const adminConfirmDeliveryAndReleasePayment = mutation({
  args: {
    adminVisitorId: v.string(),
    shipmentId: v.id("shipments"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertJordanAdminOrThrow(ctx, args.adminVisitorId);

    const shipment = await ctx.db.get(args.shipmentId);
    if (!shipment) throw new Error("Transport introuvable");

    const now = Date.now();
    await ctx.db.patch(shipment._id, {
      status: "delivered",
      deliveredAt: now,
      paymentStatus: "released",
      paymentReleasedAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("shipmentEvents", {
      shipmentId: shipment._id,
      eventType: "admin_delivery_confirmed",
      actorVisitorId: args.adminVisitorId,
      fromStatus: shipment.status,
      toStatus: "delivered",
      payload: {
        reason: args.reason ?? "Support BETA",
      },
      createdAt: now,
    });

    await ctx.db.insert("notifications", {
      recipientVisitorId: shipment.customerVisitorId,
      actorVisitorId: args.adminVisitorId,
      type: "delivery_qr_scanned",
      title: "Remise validee (support BETA)",
      message: "Le support Colib a valide la remise manuellement. Paiement libere.",
      matchId: shipment.matchId,
      tripId: shipment.tripId,
      parcelId: shipment.parcelId,
      readAt: undefined,
      createdAt: now,
    });

    return { success: true, status: "delivered", paymentStatus: "released" as const };
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
      shipment.paymentStatus !== "held" &&
      shipment.paymentStatus !== "release_pending" &&
      shipment.paymentStatus !== "released"
    ) {
      throw new Error("Paiement bloque requis avant demarrage du transport");
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
