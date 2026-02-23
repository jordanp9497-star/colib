import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const requestCode = mutation({
  args: {
    visitorId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    await ctx.db.insert("verificationCodes", {
      email: args.email.toLowerCase().trim(),
      code,
      visitorId: args.visitorId,
      expiresAt,
      used: false,
    });

    // BETA: retourne le code directement (pas d'envoi email)
    // En production, integrer un service email (Resend, SendGrid)
    console.log(`[BETA] Code de verification pour ${args.email}: ${code}`);
    return { code };
  },
});

export const verifyCode = mutation({
  args: {
    visitorId: v.string(),
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("verificationCodes")
      .withIndex("by_email_code", (q) =>
        q
          .eq("email", args.email.toLowerCase().trim())
          .eq("code", args.code)
      )
      .first();

    if (!record) return { success: false, error: "Code invalide" };
    if (record.used) return { success: false, error: "Code deja utilise" };
    if (Date.now() > record.expiresAt)
      return { success: false, error: "Code expire" };
    if (record.visitorId !== args.visitorId)
      return { success: false, error: "Code invalide" };

    await ctx.db.patch(record._id, { used: true });

    const user = await ctx.db
      .query("users")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.visitorId))
      .first();
    if (user) {
      await ctx.db.patch(user._id, {
        email: args.email.toLowerCase().trim(),
        emailVerified: true,
      });
    }

    return { success: true };
  },
});
