import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { TERMS_VERSION } from "../packages/shared/legal";

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function isGenericSocialName(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "utilisateur apple" ||
    normalized === "utilisateur google" ||
    normalized === "apple user" ||
    normalized === "google user"
  );
}

function normalizePhone(phone?: string) {
  if (!phone) return undefined;
  const cleaned = phone.trim().replace(/\s+/g, " ");
  return cleaned.length ? cleaned : undefined;
}

function normalizeText(value?: string) {
  if (!value) return undefined;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length ? cleaned : undefined;
}

function normalizeEmail(email?: string) {
  if (!email) return undefined;
  const cleaned = email.trim().toLowerCase();
  return cleaned.length ? cleaned : undefined;
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function randomSaltHex() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function hashPassword(password: string, saltHex: string) {
  const encoder = new TextEncoder();
  const rounds = 60000;
  let buffer = encoder.encode(`${saltHex}:${password}`);

  for (let index = 0; index < rounds; index += 1) {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    buffer = new Uint8Array(digest);
  }

  return toHex(buffer);
}

function assertValidPassword(password: string) {
  if (password.length < 8 || password.length > 128) {
    throw new Error("Mot de passe invalide");
  }
}

function assertValidEmail(email?: string) {
  if (!email) {
    throw new Error("Email requis");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email invalide");
  }
}

const PASSWORD_RESET_CODE_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_REQUEST_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_REQUEST_WINDOW_MS = 10 * 60 * 1000;
const PASSWORD_RESET_MAX_REQUESTS_PER_WINDOW = 3;

function hashResetCode(email: string, code: string) {
  return `${email}:${code}`;
}

function assertValidName(name: string) {
  if (name.length < 2 || name.length > 80) {
    throw new Error("Nom invalide");
  }
}

function assertValidPhone(phone?: string) {
  if (!phone) return;
  if (!/^\+?[0-9()\-\s]{6,20}$/.test(phone)) {
    throw new Error("Telephone invalide");
  }
}

function assertLength(value: string | undefined, maxLength: number, label: string) {
  if (!value) return;
  if (value.length > maxLength) {
    throw new Error(`${label} invalide`);
  }
}

function assertValidPostalCode(postalCode?: string) {
  if (!postalCode) return;
  if (!/^[A-Za-z0-9\-\s]{3,12}$/.test(postalCode)) {
    throw new Error("Code postal invalide");
  }
}

export const getByVisitorId = query({
  args: { visitorId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.visitorId))
      .first();
    if (!user) return null;
    const profilePhotoUrl = user.profilePhotoId
      ? await ctx.storage.getUrl(user.profilePhotoId)
      : null;
    return { ...user, profilePhotoUrl };
  },
});

export const getPublicProfile = query({
  args: { visitorId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.visitorId))
      .first();
    if (!user) return null;
    const profilePhotoUrl = user.profilePhotoId
      ? await ctx.storage.getUrl(user.profilePhotoId)
      : null;
    return {
      name: user.name,
      profilePhotoUrl,
      averageRating: user.averageRating ?? null,
      totalReviews: user.totalReviews ?? 0,
      identityVerified: user.identityVerified,
      emailVerified: user.emailVerified,
    };
  },
});

export const createOrUpdate = mutation({
  args: {
    visitorId: v.string(),
    name: v.string(),
    givenName: v.optional(v.string()),
    familyName: v.optional(v.string()),
    phone: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    country: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    authProvider: v.optional(v.union(v.literal("local"), v.literal("google"), v.literal("apple"), v.literal("password"))),
    authSubject: v.optional(v.string()),
    termsAccepted: v.boolean(),
    termsVersion: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.termsAccepted) {
      throw new Error("Vous devez accepter les conditions d'utilisation");
    }
    if (!args.termsVersion.trim()) {
      throw new Error("Version des conditions invalide");
    }

    const normalizedName = normalizeName(args.name);
    const normalizedPhone = normalizePhone(args.phone);
    const normalizedGivenName = normalizeText(args.givenName);
    const normalizedFamilyName = normalizeText(args.familyName);
    const normalizedAddressLine1 = normalizeText(args.addressLine1);
    const normalizedAddressLine2 = normalizeText(args.addressLine2);
    const normalizedCity = normalizeText(args.city);
    const normalizedPostalCode = normalizeText(args.postalCode);
    const normalizedCountry = normalizeText(args.country);
    const normalizedEmail = normalizeEmail(args.email);

    assertValidName(normalizedName);
    assertValidPhone(normalizedPhone);
    assertLength(normalizedGivenName, 50, "Prenom");
    assertLength(normalizedFamilyName, 50, "Nom de famille");
    assertLength(normalizedAddressLine1, 120, "Adresse");
    assertLength(normalizedAddressLine2, 120, "Complement d adresse");
    assertLength(normalizedCity, 80, "Ville");
    assertLength(normalizedCountry, 60, "Pays");
    assertLength(normalizedEmail, 120, "Email");
    assertValidPostalCode(normalizedPostalCode);

    const now = Date.now();

    const existing = await ctx.db
      .query("users")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.visitorId))
      .first();
    if (existing) {
      const nextName =
        isGenericSocialName(normalizedName) && existing.name.trim().length > 1
          ? existing.name
          : normalizedName;

      await ctx.db.patch(existing._id, {
        name: nextName,
        givenName: normalizedGivenName ?? existing.givenName,
        familyName: normalizedFamilyName ?? existing.familyName,
        phone: normalizedPhone,
        addressLine1: normalizedAddressLine1,
        addressLine2: normalizedAddressLine2,
        city: normalizedCity,
        postalCode: normalizedPostalCode,
        country: normalizedCountry,
        email: normalizedEmail ?? existing.email,
        emailVerified: args.emailVerified ?? existing.emailVerified,
        authProvider: args.authProvider ?? existing.authProvider,
        authSubject: args.authSubject ?? existing.authSubject,
        termsAcceptedAt: now,
        termsVersionAccepted: args.termsVersion,
      });
      return existing._id;
    }
    return await ctx.db.insert("users", {
      visitorId: args.visitorId,
      name: normalizedName,
      givenName: normalizedGivenName,
      familyName: normalizedFamilyName,
      addressLine1: normalizedAddressLine1,
      addressLine2: normalizedAddressLine2,
      city: normalizedCity,
      postalCode: normalizedPostalCode,
      country: normalizedCountry,
      authProvider: args.authProvider ?? "local",
      authSubject: args.authSubject,
      email: normalizedEmail,
      phone: normalizedPhone,
      emailVerified: args.emailVerified ?? false,
      identityVerified: "none",
      createdAt: new Date().toISOString(),
      termsAcceptedAt: now,
      termsVersionAccepted: args.termsVersion || TERMS_VERSION,
    });
  },
});

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveProfilePhoto = mutation({
  args: {
    visitorId: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.visitorId))
      .first();
    if (!user) throw new Error("Utilisateur introuvable");
    if (user.profilePhotoId) {
      await ctx.storage.delete(user.profilePhotoId);
    }
    await ctx.db.patch(user._id, { profilePhotoId: args.storageId });
  },
});

export const saveIdentityDocuments = mutation({
  args: {
    visitorId: v.string(),
    idCardPhotoId: v.id("_storage"),
    carteGrisePhotoId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.visitorId))
      .first();
    if (!user) throw new Error("Utilisateur introuvable");
    await ctx.db.patch(user._id, {
      idCardPhotoId: args.idCardPhotoId,
      carteGrisePhotoId: args.carteGrisePhotoId,
      identityVerified: "pending",
    });
  },
});

export const registerWithPassword = mutation({
  args: {
    givenName: v.string(),
    familyName: v.string(),
    phone: v.string(),
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    city: v.string(),
    postalCode: v.string(),
    country: v.string(),
    email: v.string(),
    password: v.string(),
    termsAccepted: v.boolean(),
    termsVersion: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.termsAccepted) {
      throw new Error("Vous devez accepter les conditions d'utilisation");
    }

    const normalizedGivenName = normalizeText(args.givenName);
    const normalizedFamilyName = normalizeText(args.familyName);
    const normalizedPhone = normalizePhone(args.phone);
    const normalizedAddressLine1 = normalizeText(args.addressLine1);
    const normalizedAddressLine2 = normalizeText(args.addressLine2);
    const normalizedCity = normalizeText(args.city);
    const normalizedPostalCode = normalizeText(args.postalCode);
    const normalizedCountry = normalizeText(args.country);
    const normalizedEmail = normalizeEmail(args.email);
    const fullName = normalizeName(`${normalizedGivenName ?? ""} ${normalizedFamilyName ?? ""}`.trim());

    assertValidName(fullName);
    assertValidPhone(normalizedPhone);
    assertLength(normalizedGivenName, 50, "Prenom");
    assertLength(normalizedFamilyName, 50, "Nom de famille");
    assertLength(normalizedAddressLine1, 120, "Adresse");
    assertLength(normalizedAddressLine2, 120, "Complement d adresse");
    assertLength(normalizedCity, 80, "Ville");
    assertLength(normalizedCountry, 60, "Pays");
    assertLength(normalizedEmail, 120, "Email");
    assertValidPostalCode(normalizedPostalCode);
    assertValidEmail(normalizedEmail);
    assertValidPassword(args.password);

    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail!))
      .first();

    if (existingByEmail) {
      throw new Error("Un compte existe deja avec cet email");
    }

    const now = Date.now();
    const salt = randomSaltHex();
    const passwordHash = await hashPassword(args.password, salt);
    const visitorId = `local_${randomSaltHex().slice(0, 12)}`;

    await ctx.db.insert("users", {
      visitorId,
      name: fullName,
      givenName: normalizedGivenName,
      familyName: normalizedFamilyName,
      addressLine1: normalizedAddressLine1,
      addressLine2: normalizedAddressLine2,
      city: normalizedCity,
      postalCode: normalizedPostalCode,
      country: normalizedCountry,
      authProvider: "password",
      authSubject: normalizedEmail,
      email: normalizedEmail,
      phone: normalizedPhone,
      emailVerified: false,
      identityVerified: "none",
      createdAt: new Date(now).toISOString(),
      termsAcceptedAt: now,
      termsVersionAccepted: args.termsVersion || TERMS_VERSION,
      passwordHash,
      passwordSalt: salt,
    });

    return { visitorId };
  },
});

export const loginWithPassword = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);
    assertValidEmail(normalizedEmail);
    assertValidPassword(args.password);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail!))
      .first();

    if (!existing || !existing.passwordHash || !existing.passwordSalt) {
      throw new Error("Email ou mot de passe invalide");
    }

    const inputHash = await hashPassword(args.password, existing.passwordSalt);
    if (inputHash !== existing.passwordHash) {
      throw new Error("Email ou mot de passe invalide");
    }

    return {
      visitorId: existing.visitorId,
      name: existing.name,
    };
  },
});

export const requestPasswordResetCode = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);
    assertValidEmail(normalizedEmail);
    const now = Date.now();

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail!))
      .first();
    if (!user || !user.passwordHash || !user.passwordSalt) {
      return { success: true };
    }

    const recordsForEmail = await ctx.db
      .query("passwordResetCodes")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail!))
      .collect();

    const recentRequests = recordsForEmail.filter((record) => record.createdAt >= now - PASSWORD_RESET_REQUEST_WINDOW_MS);
    if (recentRequests.length >= PASSWORD_RESET_MAX_REQUESTS_PER_WINDOW) {
      return {
        success: false,
        error: "Trop de demandes recentes. Reessayez dans quelques minutes.",
      };
    }

    const lastRequest = recordsForEmail.sort((a, b) => b.createdAt - a.createdAt)[0];
    if (lastRequest && now - lastRequest.createdAt < PASSWORD_RESET_REQUEST_COOLDOWN_MS) {
      const remainingMs = PASSWORD_RESET_REQUEST_COOLDOWN_MS - (now - lastRequest.createdAt);
      const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
      return {
        success: false,
        error: `Patientez ${remainingSeconds}s avant de redemander un code.`,
      };
    }

    for (const record of recordsForEmail) {
      if (!record.used && record.expiresAt > now) {
        await ctx.db.patch(record._id, { used: true });
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = hashResetCode(normalizedEmail!, code);
    const expiresAt = now + PASSWORD_RESET_CODE_TTL_MS;

    await ctx.db.insert("passwordResetCodes", {
      email: normalizedEmail!,
      codeHash,
      expiresAt,
      used: false,
      attempts: 0,
      createdAt: now,
    });

    const includeCodeInResponse = process.env.NODE_ENV !== "production";
    if (includeCodeInResponse) {
      console.log(`[BETA] Code de reset pour ${normalizedEmail}: ${code}`);
    }

    return {
      success: true,
      ...(includeCodeInResponse ? { code } : {}),
    };
  },
});

export const resetPasswordWithCode = mutation({
  args: {
    email: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);
    assertValidEmail(normalizedEmail);
    assertValidPassword(args.newPassword);

    const now = Date.now();
    const recordsForEmail = await ctx.db
      .query("passwordResetCodes")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail!))
      .collect();

    const activeRecord = recordsForEmail
      .filter((record) => !record.used && record.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    if (!activeRecord) {
      return { success: false, error: "Aucun code actif. Demandez un nouveau code." };
    }

    const currentAttempts = activeRecord.attempts;
    if (currentAttempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
      return { success: false, error: "Trop d'essais. Demandez un nouveau code." };
    }

    const providedHash = hashResetCode(normalizedEmail!, args.code.trim());
    if (providedHash !== activeRecord.codeHash) {
      const nextAttempts = currentAttempts + 1;
      await ctx.db.patch(activeRecord._id, {
        attempts: nextAttempts,
        used: nextAttempts >= PASSWORD_RESET_MAX_ATTEMPTS,
      });
      const remainingAttempts = Math.max(0, PASSWORD_RESET_MAX_ATTEMPTS - nextAttempts);
      if (remainingAttempts === 0) {
        return { success: false, error: "Trop d'essais. Demandez un nouveau code." };
      }
      return {
        success: false,
        error: `Code invalide. Il vous reste ${remainingAttempts} essai(s).`,
      };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail!))
      .first();
    if (!user || !user.passwordHash || !user.passwordSalt) {
      return { success: false, error: "Compte introuvable pour cet email." };
    }

    const salt = randomSaltHex();
    const passwordHash = await hashPassword(args.newPassword, salt);

    await ctx.db.patch(user._id, {
      passwordHash,
      passwordSalt: salt,
      authProvider: user.authProvider ?? "password",
    });

    await ctx.db.patch(activeRecord._id, { used: true });
    for (const record of recordsForEmail) {
      if (record._id !== activeRecord._id && !record.used) {
        await ctx.db.patch(record._id, { used: true });
      }
    }

    return { success: true };
  },
});

export const updateName = mutation({
  args: {
    visitorId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_visitorId", (q) => q.eq("visitorId", args.visitorId))
      .first();
    if (!user) throw new Error("Utilisateur introuvable");
    await ctx.db.patch(user._id, { name: args.name });
  },
});
