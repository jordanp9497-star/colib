import { internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { haversineKm } from "./lib/geo";
import {
  canSendPushInCurrentHour,
  DEFAULT_DRIVER_NOTIFICATION_SETTINGS,
  normalizeDriverNotificationSettings,
} from "../packages/shared/smartNotifications";

const STAGE_1_RADIUS_KM = 5;
const STAGE_2_RADIUS_KM = 7;
const STAGE_3_RADIUS_KM = 12;
const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;
const STAGE_2_DELAY_MS = 5 * 60 * 1000;
const STAGE_3_DELAY_MS = 10 * 60 * 1000;
const TIP_DELAY_MS = 15 * 60 * 1000;

type NotifiableParcel = {
  _id: Id<"parcels">;
  ownerVisitorId: string;
  origin: string;
  destination: string;
  originAddress: { lat: number; lng: number; city?: string; label: string };
  proposedPrice?: number;
  urgencyLevel: "normal" | "urgent" | "express";
  status: string;
  createdAt: number;
};

function isParcelOpen(status: string) {
  return status === "published" || status === "open";
}

async function sendDriverNotificationsForStage(args: {
  ctx: any;
  parcel: NotifiableParcel;
  stage: 1 | 2 | 3;
  radiusKm: number;
  now: number;
}) {
  const users = await args.ctx.db
    .query("users")
    .withIndex("by_is_online", (q: any) => q.eq("isOnline", true))
    .collect();

  let sentCount = 0;
  let pushFailures = 0;

  for (const user of users) {
    if (user.visitorId === args.parcel.ownerVisitorId) continue;
    if (!user.lastActiveAt || user.lastActiveAt < args.now - ACTIVE_WINDOW_MS) continue;
    if (!user.lastKnownLocation) continue;

    const settings = normalizeDriverNotificationSettings(user.notificationSettings ?? DEFAULT_DRIVER_NOTIFICATION_SETTINGS);
    const effectiveRadius = Math.min(args.radiusKm, settings.notifyRadiusKm);
    const distanceKm = haversineKm(
      { lat: args.parcel.originAddress.lat, lng: args.parcel.originAddress.lng },
      { lat: user.lastKnownLocation.lat, lng: user.lastKnownLocation.lng }
    );
    if (distanceKm > effectiveRadius) continue;

    const alreadyLogged = await args.ctx.db
      .query("deliveryNotificationLogs")
      .withIndex("by_parcel_driver", (q: any) => q.eq("parcelId", args.parcel._id).eq("driverId", user.visitorId))
      .first();
    if (alreadyLogged) continue;

    const sentInLastHour = await args.ctx.db
      .query("deliveryNotificationLogs")
      .withIndex("by_driver_sent", (q: any) => q.eq("driverId", user.visitorId).gte("sentAt", args.now - 60 * 60 * 1000))
      .collect();
    if (!canSendPushInCurrentHour({ sentInLastHour: sentInLastHour.length, maxPushPerHour: settings.maxPushPerHour })) {
      continue;
    }

    if (settings.minPrice !== undefined) {
      if (!Number.isFinite(args.parcel.proposedPrice) || (args.parcel.proposedPrice ?? 0) < settings.minPrice) {
        continue;
      }
    }

    if (settings.urgentOnly && args.parcel.urgencyLevel === "normal") {
      continue;
    }

    try {
      const priceLabel = Number.isFinite(args.parcel.proposedPrice)
        ? `${args.parcel.proposedPrice} EUR`
        : "prix flexible";
      let delivered = false;
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          await args.ctx.db.insert("notifications", {
            recipientVisitorId: user.visitorId,
            actorVisitorId: args.parcel.ownerVisitorId,
            type: "parcel_new",
            title: "Nouveau colis proche",
            message: `${args.parcel.origin} -> ${args.parcel.destination} · ${priceLabel} · ${args.parcel.urgencyLevel}`,
            matchId: undefined,
            tripId: undefined,
            parcelId: args.parcel._id,
            readAt: undefined,
            createdAt: args.now,
          });
          delivered = true;
          break;
        } catch (attemptError) {
          lastError = attemptError;
        }
      }

      if (!delivered) {
        throw lastError instanceof Error ? lastError : new Error("notification_insert_failed");
      }

      await args.ctx.db.insert("deliveryNotificationLogs", {
        parcelId: args.parcel._id,
        driverId: user.visitorId,
        stage: args.stage,
        radiusKm: args.radiusKm,
        sentAt: args.now,
        providerResponse: "in_app_local_push",
        error: undefined,
      });

      sentCount += 1;
    } catch (error) {
      pushFailures += 1;
      await args.ctx.db.insert("deliveryNotificationLogs", {
        parcelId: args.parcel._id,
        driverId: user.visitorId,
        stage: args.stage,
        radiusKm: args.radiusKm,
        sentAt: args.now,
        providerResponse: undefined,
        error: error instanceof Error ? error.message.slice(0, 180) : "unknown_error",
      });
    }
  }

  return { sentCount, pushFailures };
}

async function markPendingEscalationsCancelled(ctx: any, parcelId: Id<"parcels">, now: number) {
  const pendingEscalations = await ctx.db
    .query("scheduledEscalations")
    .withIndex("by_parcel_status", (q: any) => q.eq("parcelId", parcelId).eq("status", "pending"))
    .collect();

  for (const escalation of pendingEscalations) {
    await ctx.db.patch(escalation._id, {
      status: "cancelled",
      updatedAt: now,
    });
  }
}

export async function triggerSmartNotificationsForParcel(ctx: any, parcelId: Id<"parcels">) {
  const now = Date.now();
  const parcel = await ctx.db.get(parcelId);
  if (!parcel || !isParcelOpen(parcel.status)) {
    return { stage1SentCount: 0, pushFailuresCount: 0 };
  }

  const stage1 = await sendDriverNotificationsForStage({
    ctx,
    parcel,
    stage: 1,
    radiusKm: STAGE_1_RADIUS_KM,
    now,
  });

  console.log(
    JSON.stringify({
      event: "parcel_created",
      parcelId: String(parcelId),
      notifications_stage1_sent_count: stage1.sentCount,
      push_failures_count: stage1.pushFailures,
    })
  );

  const stage2EscalationId = await ctx.db.insert("scheduledEscalations", {
    parcelId,
    stage: 2,
    nextStageAt: now + STAGE_2_DELAY_MS,
    status: "pending",
    sentCount: undefined,
    createdAt: now,
    updatedAt: now,
  });

  const stage3EscalationId = await ctx.db.insert("scheduledEscalations", {
    parcelId,
    stage: 3,
    nextStageAt: now + STAGE_3_DELAY_MS,
    status: "pending",
    sentCount: undefined,
    createdAt: now,
    updatedAt: now,
  });

  const tipEscalationId = await ctx.db.insert("scheduledEscalations", {
    parcelId,
    stage: 4,
    nextStageAt: now + TIP_DELAY_MS,
    status: "pending",
    sentCount: undefined,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.scheduler.runAfter(STAGE_2_DELAY_MS, (internal as any).smartNotifications.runEscalationStage, {
    escalationId: stage2EscalationId,
  });
  await ctx.scheduler.runAfter(STAGE_3_DELAY_MS, (internal as any).smartNotifications.runEscalationStage, {
    escalationId: stage3EscalationId,
  });
  await ctx.scheduler.runAfter(TIP_DELAY_MS, (internal as any).smartNotifications.runEscalationStage, {
    escalationId: tipEscalationId,
  });

  return {
    stage1SentCount: stage1.sentCount,
    pushFailuresCount: stage1.pushFailures,
  };
}

export const cancelEscalationsForParcel = mutation({
  args: {
    parcelId: v.id("parcels"),
  },
  handler: async (ctx, args) => {
    await markPendingEscalationsCancelled(ctx, args.parcelId, Date.now());
    return { success: true };
  },
});

export const runEscalationStage = internalMutation({
  args: {
    escalationId: v.id("scheduledEscalations"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const escalation = await ctx.db.get(args.escalationId);
    if (!escalation || escalation.status !== "pending") {
      return { skipped: true };
    }

    const parcel = await ctx.db.get(escalation.parcelId);
    if (!parcel || !isParcelOpen(parcel.status)) {
      await ctx.db.patch(escalation._id, {
        status: "cancelled",
        updatedAt: now,
      });
      return { skipped: true };
    }

    if (escalation.stage === 4) {
      await ctx.db.insert("notifications", {
        recipientVisitorId: parcel.ownerVisitorId,
        actorVisitorId: undefined,
        type: "parcel_visibility_tip",
        title: "Peu de transporteurs pour ce colis",
        message:
          "Votre colis attire peu de transporteurs. Astuce: augmentez le prix ou assouplissez l heure de prise en charge.",
        matchId: undefined,
        tripId: undefined,
        parcelId: parcel._id,
        readAt: undefined,
        createdAt: now,
      });

      await ctx.db.patch(escalation._id, {
        status: "done",
        sentCount: 1,
        updatedAt: now,
      });
      return { done: true, stage: 4, sentCount: 1 };
    }

    const radiusKm = escalation.stage === 2 ? STAGE_2_RADIUS_KM : STAGE_3_RADIUS_KM;
    const result = await sendDriverNotificationsForStage({
      ctx,
      parcel,
      stage: escalation.stage,
      radiusKm,
      now,
    });

    await ctx.db.patch(escalation._id, {
      status: "done",
      sentCount: result.sentCount,
      updatedAt: now,
    });

    console.log(
      JSON.stringify({
        event: "parcel_escalation",
        parcelId: String(parcel._id),
        stage: escalation.stage,
        stage2_sent_count: escalation.stage === 2 ? result.sentCount : 0,
        stage3_sent_count: escalation.stage === 3 ? result.sentCount : 0,
        push_failures_count: result.pushFailures,
      })
    );

    return { done: true, stage: escalation.stage, sentCount: result.sentCount };
  },
});

export const cancelEscalationsIfMatched = mutation({
  args: {
    parcelId: v.id("parcels"),
  },
  handler: async (ctx, args) => {
    const parcel = await ctx.db.get(args.parcelId);
    if (!parcel || isParcelOpen(parcel.status)) {
      return { cancelled: 0 };
    }

    const now = Date.now();
    await markPendingEscalationsCancelled(ctx, args.parcelId, now);
    return { cancelled: 1 };
  },
});
