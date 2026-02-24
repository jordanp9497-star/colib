import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_createdAt", (q) => q.eq("recipientVisitorId", args.userId))
      .order("desc")
      .take(50);

    const enriched = [];
    for (const item of notifications) {
      let matchStatus: string | undefined;
      if (item.matchId) {
        const match = await ctx.db.get(item.matchId);
        matchStatus = match?.status;
      }
      enriched.push({
        ...item,
        matchStatus,
      });
    }

    return enriched;
  },
});

export const markAsRead = mutation({
  args: {
    notificationId: v.id("notifications"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error("Notification introuvable");
    if (notification.recipientVisitorId !== args.userId) {
      throw new Error("Non autorise");
    }

    await ctx.db.patch(args.notificationId, {
      readAt: Date.now(),
    });
  },
});
