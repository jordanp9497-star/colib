import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Platform } from "react-native";
import { useQuery, useMutation } from "convex/react";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import { api } from "@/convex/_generated/api";
import { TERMS_VERSION } from "@/packages/shared/legal";

WebBrowser.maybeCompleteAuthSession();

// expo-secure-store ne fonctionne pas sur web
let SecureStore: typeof import("expo-secure-store") | null = null;
if (Platform.OS !== "web") {
  SecureStore = require("expo-secure-store");
}

const VISITOR_ID_KEY = "colib_visitor_id";

function generateVisitorId() {
  return Math.random().toString(36).substring(2, 10);
}

function normalizePseudoToken(value?: string) {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function buildAuthPseudo(params: {
  givenName?: string;
  familyName?: string;
  email?: string;
  subject: string;
  provider: "google" | "apple";
}) {
  const emailLocalPart = params.email?.split("@")[0];
  const tokenCandidates = [
    [params.givenName, params.familyName].filter(Boolean).join(""),
    params.givenName,
    params.familyName,
    emailLocalPart,
  ];

  const token = tokenCandidates.map((value) => normalizePseudoToken(value)).find((value) => value.length >= 3);
  const fallbackSubject = normalizePseudoToken(params.subject).slice(-6) || Math.random().toString(36).slice(2, 8);
  const providerPrefix = params.provider === "apple" ? "apple" : "google";
  return `${providerPrefix}_${token || fallbackSubject}`;
}

interface UserRecord {
  _id: string;
  visitorId: string;
  name: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  emailVerified: boolean;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  authProvider?: "local" | "google" | "apple" | "password";
  authSubject?: string;
  termsAcceptedAt?: number;
  termsVersionAccepted?: string;
  profilePhotoUrl: string | null;
  profilePhotoId?: string;
  idCardPhotoId?: string;
  carteGrisePhotoId?: string;
  identityVerified: "none" | "pending" | "verified" | "rejected";
  averageRating?: number;
  totalReviews?: number;
  createdAt: number | string;
}

interface UserContextType {
  userId: string;
  userName: string;
  user: UserRecord | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  register: (profile: RegistrationPayload, termsAccepted?: boolean) => Promise<void>;
  registerWithPassword: (profile: RegistrationPayload & { email: string; password: string }, termsAccepted?: boolean) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  requestPasswordResetCode: (email: string) => Promise<{ success: boolean; code?: string; error?: string }>;
  resetPasswordWithCode: (email: string, code: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  loginWithVisitorId: (visitorId: string) => Promise<void>;
  loginWithGoogle: (termsAccepted?: boolean) => Promise<void>;
  loginWithApple: (termsAccepted?: boolean) => Promise<void>;
  logout: () => void;
}

interface RegistrationPayload {
  givenName: string;
  familyName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  country: string;
}

const UserContext = createContext<UserContextType>({
  userId: "",
  userName: "",
  user: null,
  isLoggedIn: false,
  isLoading: true,
  register: async () => {},
  registerWithPassword: async () => {},
  loginWithPassword: async () => {},
  requestPasswordResetCode: async () => ({ success: false }),
  resetPasswordWithCode: async () => ({ success: false }),
  loginWithVisitorId: async () => {},
  loginWithGoogle: async () => {},
  loginWithApple: async () => {},
  logout: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [visitorId, setVisitorId] = useState<string>("");
  const [idReady, setIdReady] = useState(false);
  const [googleRequest, , promptGoogleAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    scopes: ["openid", "profile", "email"],
  });

  // Charger ou generer le visitorId au demarrage
  useEffect(() => {
    async function loadId() {
      let id: string | null = null;
      if (SecureStore) {
        try {
          id = await SecureStore.getItemAsync(VISITOR_ID_KEY);
        } catch {
          // ignore
        }
      } else {
        // Web: utiliser localStorage
        try {
          id = localStorage.getItem(VISITOR_ID_KEY);
        } catch {
          // ignore
        }
      }
      if (!id) {
        id = generateVisitorId();
        if (SecureStore) {
          try {
            await SecureStore.setItemAsync(VISITOR_ID_KEY, id);
          } catch {
            // ignore
          }
        } else {
          try {
            localStorage.setItem(VISITOR_ID_KEY, id);
          } catch {
            // ignore
          }
        }
      }
      setVisitorId(id);
      setIdReady(true);
    }
    loadId();
  }, []);

  // Requete Convex pour le user (reactif)
  const user = useQuery(
    api.users.getByVisitorId,
    idReady && visitorId ? { visitorId } : "skip"
  );

  const createOrUpdate = useMutation(api.users.createOrUpdate);
  const registerWithPasswordMutation = useMutation(api.users.registerWithPassword);
  const loginWithPasswordMutation = useMutation(api.users.loginWithPassword);
  const requestPasswordResetCodeMutation = useMutation(api.users.requestPasswordResetCode);
  const resetPasswordWithCodeMutation = useMutation(api.users.resetPasswordWithCode);

  const persistVisitorId = useCallback(async (id: string) => {
    setVisitorId(id);
    if (SecureStore) {
      try {
        await SecureStore.setItemAsync(VISITOR_ID_KEY, id);
      } catch {
        // ignore
      }
    } else {
      try {
        localStorage.setItem(VISITOR_ID_KEY, id);
      } catch {
        // ignore
      }
    }
  }, []);

  const register = useCallback(
    async (profile: RegistrationPayload, termsAccepted = false) => {
      if (!visitorId) return;
      const givenName = profile.givenName.trim();
      const familyName = profile.familyName.trim();
      const fullName = `${givenName} ${familyName}`.trim();
      await createOrUpdate({
        visitorId,
        name: fullName,
        givenName,
        familyName,
        phone: profile.phone.trim(),
        addressLine1: profile.addressLine1.trim(),
        addressLine2: profile.addressLine2?.trim() || undefined,
        city: profile.city.trim(),
        postalCode: profile.postalCode.trim(),
        country: profile.country.trim(),
        authProvider: "local",
        termsAccepted,
        termsVersion: TERMS_VERSION,
      });
    },
    [visitorId, createOrUpdate]
  );

  const loginWithVisitorId = useCallback(
    async (nextVisitorId: string) => {
      const normalized = nextVisitorId.trim();
      if (!normalized) {
        throw new Error("Identifiant utilisateur invalide");
      }
      await persistVisitorId(normalized);
    },
    [persistVisitorId]
  );

  const registerWithPassword = useCallback(
    async (profile: RegistrationPayload & { email: string; password: string }, termsAccepted = false) => {
      const givenName = profile.givenName.trim();
      const familyName = profile.familyName.trim();

      await registerWithPasswordMutation({
        givenName,
        familyName,
        phone: profile.phone.trim(),
        addressLine1: profile.addressLine1.trim(),
        addressLine2: profile.addressLine2?.trim() || undefined,
        city: profile.city.trim(),
        postalCode: profile.postalCode.trim(),
        country: profile.country.trim(),
        email: profile.email.trim().toLowerCase(),
        password: profile.password,
        termsAccepted,
        termsVersion: TERMS_VERSION,
      });
    },
    [registerWithPasswordMutation]
  );

  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      const result = await loginWithPasswordMutation({
        email: email.trim().toLowerCase(),
        password,
      });
      await persistVisitorId(result.visitorId);
    },
    [loginWithPasswordMutation, persistVisitorId]
  );

  const requestPasswordResetCode = useCallback(
    async (email: string) => {
      return await requestPasswordResetCodeMutation({
        email: email.trim().toLowerCase(),
      });
    },
    [requestPasswordResetCodeMutation]
  );

  const resetPasswordWithCode = useCallback(
    async (email: string, code: string, newPassword: string) => {
      return await resetPasswordWithCodeMutation({
        email: email.trim().toLowerCase(),
        code: code.trim(),
        newPassword,
      });
    },
    [resetPasswordWithCodeMutation]
  );

  const loginWithGoogle = useCallback(
    async (termsAccepted = false) => {
      if (!termsAccepted) {
        throw new Error("Conditions non acceptees");
      }
      if (!googleRequest) {
        throw new Error("Configuration Google OAuth manquante");
      }

      const result = await promptGoogleAsync();
      if (result.type !== "success") {
        throw new Error("Connexion Google annulee");
      }

      const accessToken = result.authentication?.accessToken;
      if (!accessToken) {
        throw new Error("Token Google manquant");
      }

      const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new Error("Impossible de recuperer le profil Google");
      }
      const profile = (await response.json()) as {
        sub?: string;
        name?: string;
        given_name?: string;
        family_name?: string;
        email?: string;
        email_verified?: boolean;
      };
      if (!profile.sub) {
        throw new Error("Identifiant Google invalide");
      }

      const givenName = profile.given_name?.trim();
      const familyName = profile.family_name?.trim();
      const fallbackPseudo = buildAuthPseudo({
        givenName,
        familyName,
        email: profile.email?.trim().toLowerCase(),
        subject: profile.sub,
        provider: "google",
      });

      const visitorIdFromGoogle = `google_${profile.sub}`;
      await createOrUpdate({
        visitorId: visitorIdFromGoogle,
        name: profile.name?.trim() || fallbackPseudo,
        givenName,
        familyName,
        email: profile.email?.trim().toLowerCase(),
        emailVerified: Boolean(profile.email_verified),
        authProvider: "google",
        authSubject: profile.sub,
        termsAccepted,
        termsVersion: TERMS_VERSION,
      });
      await persistVisitorId(visitorIdFromGoogle);
    },
    [createOrUpdate, googleRequest, persistVisitorId, promptGoogleAsync]
  );

  const loginWithApple = useCallback(
    async (termsAccepted = false) => {
      if (!termsAccepted) {
        throw new Error("Conditions non acceptees");
      }
      const isAppleAuthAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAppleAuthAvailable) {
        throw new Error("Connexion Apple indisponible sur cet appareil");
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.user) {
        throw new Error("Identifiant Apple manquant");
      }

      const givenName = credential.fullName?.givenName?.trim();
      const familyName = credential.fullName?.familyName?.trim();
      const fullName = [givenName, familyName].filter(Boolean).join(" ").trim();
      const fallbackPseudo = buildAuthPseudo({
        givenName,
        familyName,
        email: credential.email?.trim().toLowerCase(),
        subject: credential.user,
        provider: "apple",
      });
      const visitorIdFromApple = `apple_${credential.user}`;
      await createOrUpdate({
        visitorId: visitorIdFromApple,
        name: fullName || fallbackPseudo,
        givenName,
        familyName,
        email: credential.email?.trim().toLowerCase(),
        emailVerified: Boolean(credential.email),
        authProvider: "apple",
        authSubject: credential.user,
        termsAccepted,
        termsVersion: TERMS_VERSION,
      });
      await persistVisitorId(visitorIdFromApple);
    },
    [createOrUpdate, persistVisitorId]
  );

  const logout = useCallback(() => {
    const newId = generateVisitorId();
    void persistVisitorId(newId);
  }, [persistVisitorId]);

  const isLoading = !idReady || user === undefined;
  const isLoggedIn =
    user !== null &&
    user !== undefined &&
    Boolean(user.termsAcceptedAt) &&
    user.termsVersionAccepted === TERMS_VERSION;

  return (
    <UserContext.Provider
      value={{
        userId: visitorId,
        userName: user?.name ?? "",
        user: (user as UserRecord) ?? null,
        isLoggedIn,
        isLoading,
        register,
        registerWithPassword,
        loginWithPassword,
        requestPasswordResetCode,
        resetPasswordWithCode,
        loginWithVisitorId,
        loginWithGoogle,
        loginWithApple,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
