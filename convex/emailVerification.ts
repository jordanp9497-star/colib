import { mutation } from "./_generated/server";
import { v } from "convex/values";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;
const REQUEST_WINDOW_MS = 10 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

function hashVerificationCode(email: string, code: string) {
  return `${email}:${code}`;
}

export const requestCode = mutation({
  args: {
    visitorId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);
    const now = Date.now();

    const recordsForVisitor = await ctx.db
      .query("verificationCodes")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.visitorId))
      .collect();

    const recentRequests = recordsForVisitor.filter(
      (record) => record.createdAt >= now - REQUEST_WINDOW_MS
    );
    if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
      return {
        success: false,
        error: "Trop de demandes recentes. Reessayez dans quelques minutes.",
      };
    }

    const lastRequest = recordsForVisitor
      .filter((record) => record.email === normalizedEmail)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    if (lastRequest && now - lastRequest.createdAt < REQUEST_COOLDOWN_MS) {
      const remainingMs = REQUEST_COOLDOWN_MS - (now - lastRequest.createdAt);
      const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
      return {
        success: false,
        error: `Patientez ${remainingSeconds}s avant de redemander un code.`,
      };
    }

    for (const record of recordsForVisitor) {
      if (record.email === normalizedEmail && !record.used && record.expiresAt > now) {
        await ctx.db.patch(record._id, { used: true });
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = now + CODE_TTL_MS;

    await ctx.db.insert("verificationCodes", {
      email: normalizedEmail,
      code: hashVerificationCode(normalizedEmail, code),
      visitorId: args.visitorId,
      expiresAt,
      used: false,
      attempts: 0,
      createdAt: now,
    });

    const includeCodeInResponse = process.env.NODE_ENV !== "production";
    if (includeCodeInResponse) {
      console.log(`[BETA] Code de verification pour ${normalizedEmail}: ${code}`);
    }

    return {
      success: true,
      ...(includeCodeInResponse ? { code } : {}),
    };
  },
});

export const verifyCode = mutation({
  args: {
    visitorId: v.string(),
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);
    const now = Date.now();
    const normalizedCode = args.code.trim();

    const recordsForVisitor = await ctx.db
      .query("verificationCodes")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.visitorId))
      .collect();

    const activeRecord = recordsForVisitor
      .filter(
        (record) =>
          record.email === normalizedEmail && !record.used && record.expiresAt > now
      )
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    if (!activeRecord) {
      return { success: false, error: "Aucun code actif. Demandez un nouveau code." };
    }

    if (activeRecord.attempts >= MAX_VERIFY_ATTEMPTS) {
      return {
        success: false,
        error: "Trop d'essais. Demandez un nouveau code.",
      };
    }

    const providedCodeHash = hashVerificationCode(normalizedEmail, normalizedCode);
    if (providedCodeHash !== activeRecord.code) {
      const nextAttempts = activeRecord.attempts + 1;
      await ctx.db.patch(activeRecord._id, {
        attempts: nextAttempts,
        used: nextAttempts >= MAX_VERIFY_ATTEMPTS,
      });
      const remainingAttempts = Math.max(0, MAX_VERIFY_ATTEMPTS - nextAttempts);
      if (remainingAttempts === 0) {
        return { success: false, error: "Trop d'essais. Demandez un nouveau code." };
      }
      return {
        success: false,
        error: `Code invalide. Il vous reste ${remainingAttempts} essai(s).`,
      };
    }

    await ctx.db.patch(activeRecord._id, { used: true });

    for (const record of recordsForVisitor) {
      if (record._id !== activeRecord._id && record.email === normalizedEmail && !record.used) {
        await ctx.db.patch(record._id, { used: true });
      }
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.visitorId))
      .first();
    if (!user) {
      return {
        success: false,
        error: "Profil introuvable. Creez votre profil avant de verifier l'email.",
      };
    }

    const usersWithEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .collect();
    const emailAlreadyVerifiedElsewhere = usersWithEmail.some(
      (u) => u.visitorId !== args.visitorId && u.emailVerified
    );
    if (emailAlreadyVerifiedElsewhere) {
      return {
        success: false,
        error: "Cet email est deja utilise par un autre compte.",
      };
    }

    await ctx.db.patch(user._id, {
      email: normalizedEmail,
      emailVerified: true,
    });

    return { success: true };
  },
});
