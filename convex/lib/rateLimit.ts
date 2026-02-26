import type { MutationCtx } from "../_generated/server";

export async function consumeRateLimit(args: {
  ctx: MutationCtx;
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  const windowStart = now - (now % args.windowMs);
  const entry = await args.ctx.db
    .query("requestRateLimits")
    .withIndex("by_key_window", (q) => q.eq("key", args.key).eq("windowStart", windowStart))
    .first();

  if (!entry) {
    await args.ctx.db.insert("requestRateLimits", {
      key: args.key,
      windowStart,
      count: 1,
      updatedAt: now,
    });
    return { allowed: true, remaining: Math.max(0, args.limit - 1) };
  }

  if (entry.count >= args.limit) {
    return { allowed: false, remaining: 0 };
  }

  await args.ctx.db.patch(entry._id, {
    count: entry.count + 1,
    updatedAt: now,
  });
  return { allowed: true, remaining: Math.max(0, args.limit - (entry.count + 1)) };
}
