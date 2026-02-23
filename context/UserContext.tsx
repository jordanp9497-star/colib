import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Platform } from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// expo-secure-store ne fonctionne pas sur web
let SecureStore: typeof import("expo-secure-store") | null = null;
if (Platform.OS !== "web") {
  SecureStore = require("expo-secure-store");
}

const VISITOR_ID_KEY = "colib_visitor_id";

function generateVisitorId() {
  return Math.random().toString(36).substring(2, 10);
}

interface UserRecord {
  _id: string;
  visitorId: string;
  name: string;
  email?: string;
  emailVerified: boolean;
  phone?: string;
  profilePhotoUrl: string | null;
  profilePhotoId?: string;
  idCardPhotoId?: string;
  carteGrisePhotoId?: string;
  identityVerified: "none" | "pending" | "verified" | "rejected";
  averageRating?: number;
  totalReviews?: number;
  createdAt: string;
}

interface UserContextType {
  userId: string;
  userName: string;
  user: UserRecord | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  register: (name: string, phone?: string) => Promise<void>;
  logout: () => void;
}

const UserContext = createContext<UserContextType>({
  userId: "",
  userName: "",
  user: null,
  isLoggedIn: false,
  isLoading: true,
  register: async () => {},
  logout: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [visitorId, setVisitorId] = useState<string>("");
  const [idReady, setIdReady] = useState(false);

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

  const register = useCallback(
    async (name: string, phone?: string) => {
      if (!visitorId) return;
      await createOrUpdate({
        visitorId,
        name: name.trim(),
        phone: phone?.trim() || undefined,
      });
    },
    [visitorId, createOrUpdate]
  );

  const logout = useCallback(() => {
    // Generer un nouveau visitorId (deconnexion = nouveau profil)
    const newId = generateVisitorId();
    setVisitorId(newId);
    if (SecureStore) {
      SecureStore.setItemAsync(VISITOR_ID_KEY, newId).catch(() => {});
    } else {
      try {
        localStorage.setItem(VISITOR_ID_KEY, newId);
      } catch {
        // ignore
      }
    }
  }, []);

  const isLoading = !idReady || user === undefined;
  const isLoggedIn = user !== null && user !== undefined;

  return (
    <UserContext.Provider
      value={{
        userId: visitorId,
        userName: user?.name ?? "",
        user: (user as UserRecord) ?? null,
        isLoggedIn,
        isLoading,
        register,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
