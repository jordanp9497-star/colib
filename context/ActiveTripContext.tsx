import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/context/UserContext";
import { openNavigationApp } from "@/utils/navigation";
import {
  shouldPushLocationUpdate,
  type LocationPoint,
  LOCATION_PUSH_MIN_DISTANCE_METERS,
  LOCATION_PUSH_MIN_INTERVAL_MS,
} from "@/utils/tripTracking";

let SecureStore: typeof import("expo-secure-store") | null = null;
if (Platform.OS !== "web") {
  SecureStore = require("expo-secure-store");
}

type AddressInput = {
  label: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
  placeId: string;
  lat: number;
  lng: number;
};

type ActiveSessionSnapshot = {
  tripSessionId: string;
  destinationLabel: string;
  deviationMaxMinutes: 5 | 10 | 20 | 30;
  startedAt: number;
  matchesCount: number;
};

type StartTripInput = {
  origin: AddressInput;
  destination: AddressInput;
  deviationMaxMinutes: 5 | 10 | 20 | 30;
  opportunitiesEnabled: boolean;
};

type ActiveTripContextType = {
  activeSession: ActiveSessionSnapshot | null;
  startTrip: (input: StartTripInput) => Promise<{ success: boolean; error?: string }>;
  stopTrip: () => Promise<void>;
  setMatchesCount: (count: number) => void;
};

const STORAGE_KEY = "colib_active_trip_session";

const ActiveTripContext = createContext<ActiveTripContextType>({
  activeSession: null,
  startTrip: async () => ({ success: false, error: "not_ready" }),
  stopTrip: async () => {},
  setMatchesCount: () => {},
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function ActiveTripProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useUser();
  const serverActive = useQuery((api as any).tripSessions.getActiveByUser, { userId }) as any;
  const startTripMutation = useMutation((api as any).tripSessions.start);
  const stopTripMutation = useMutation((api as any).tripSessions.stop);
  const pushLocation = useMutation((api as any).tripSessions.pushLocation);
  const notificationsFeed = useQuery((api as any).notifications.listForUser, { userId }) as any[] | undefined;

  const [localFallback, setLocalFallback] = useState<ActiveSessionSnapshot | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastPushedLocationRef = useRef<LocationPoint | null>(null);
  const isPushingRef = useRef(false);
  const pushBootTsRef = useRef(Date.now());
  const pushedNotificationIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!SecureStore) return;
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((value) => {
        if (!value) return;
        try {
          const parsed = JSON.parse(value) as ActiveSessionSnapshot;
          setLocalFallback(parsed);
        } catch {
          // Ignore corrupted cache.
        }
      })
      .catch(() => {});
  }, []);

  const persistSnapshot = useCallback(async (snapshot: ActiveSessionSnapshot | null) => {
    if (!SecureStore) return;
    try {
      if (!snapshot) {
        await SecureStore.deleteItemAsync(STORAGE_KEY);
      } else {
        await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(snapshot));
      }
    } catch {
      // Best effort persistence only.
    }
  }, []);

  const activeSession = useMemo<ActiveSessionSnapshot | null>(() => {
    if (serverActive) {
      return {
        tripSessionId: String(serverActive._id),
        destinationLabel: serverActive.destination.label,
        deviationMaxMinutes: serverActive.deviationMaxMinutes,
        startedAt: serverActive.startedAt,
        matchesCount: serverActive.matchesCountCache,
      };
    }
    return localFallback;
  }, [localFallback, serverActive]);

  useEffect(() => {
    if (!activeSession) {
      setLocalFallback(null);
      void persistSnapshot(null);
      return;
    }
    setLocalFallback(activeSession);
    void persistSnapshot(activeSession);
  }, [activeSession, persistSnapshot]);

  const setMatchesCount = useCallback((count: number) => {
    setLocalFallback((current) => {
      if (!current) return current;
      const next = { ...current, matchesCount: count };
      void persistSnapshot(next);
      return next;
    });
  }, [persistSnapshot]);

  const stopTracking = useCallback(async () => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
    lastPushedLocationRef.current = null;
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data;
      const tripSessionId = data?.tripSessionId;
      if (typeof tripSessionId === "string") {
        router.push({ pathname: "/trip/active-matches", params: { tripSessionId } } as any);
        return;
      }

      const kind = data?.kind;
      if (kind === "reservation_request") {
        router.push("/(tabs)/activity" as any);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" || !notificationsFeed) {
      return;
    }

    for (const notification of notificationsFeed) {
      if (
        notification.type !== "reservation_request" ||
        notification.readAt ||
        notification.createdAt < pushBootTsRef.current ||
        pushedNotificationIdsRef.current.has(String(notification._id))
      ) {
        continue;
      }

      pushedNotificationIdsRef.current.add(String(notification._id));
      void Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.message,
          data: {
            kind: "reservation_request",
            matchId: notification.matchId ? String(notification.matchId) : undefined,
          },
        },
        trigger: null,
      });
    }
  }, [notificationsFeed]);

  useEffect(() => {
    let mounted = true;

    const startTracking = async () => {
      if (!activeSession || Platform.OS === "web") {
        await stopTracking();
        return;
      }

      const fg = await Location.getForegroundPermissionsAsync();
      if (fg.status !== "granted") {
        return;
      }

      if (locationSubscriptionRef.current) {
        return;
      }

      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: LOCATION_PUSH_MIN_INTERVAL_MS,
          distanceInterval: LOCATION_PUSH_MIN_DISTANCE_METERS,
          mayShowUserSettingsDialog: true,
        },
        async (location: any) => {
          if (!mounted || !activeSession || isPushingRef.current) {
            return;
          }

          const nextPoint: LocationPoint = {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            timestamp: location.timestamp,
          };

          if (!shouldPushLocationUpdate(lastPushedLocationRef.current, nextPoint)) {
            return;
          }

          isPushingRef.current = true;
          try {
            const result = await pushLocation({
              tripSessionId: activeSession.tripSessionId,
              userId,
              location: nextPoint,
            });
            lastPushedLocationRef.current = nextPoint;
            if (typeof result?.matchesCount === "number") {
              setMatchesCount(result.matchesCount);
            }

            if (result?.shouldNotify) {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: `${result.matchesCount} colis dispo sur ton trajet`,
                  body: `Vers ${result.destinationLabel}`,
                  data: { tripSessionId: activeSession.tripSessionId },
                },
                trigger: null,
              });
            }
          } catch {
            // No hard failure in tracking loop.
          } finally {
            isPushingRef.current = false;
          }
        }
      );
    };

    void startTracking();

    return () => {
      mounted = false;
    };
  }, [activeSession, pushLocation, setMatchesCount, stopTracking, userId]);

  const startTrip = useCallback(async (input: StartTripInput) => {
    if (Platform.OS !== "web") {
      const foregroundPermission = await Location.requestForegroundPermissionsAsync();
      if (foregroundPermission.status !== "granted") {
        return { success: false, error: "location_foreground_denied" };
      }

      if (input.opportunitiesEnabled) {
        const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
        if (backgroundPermission.status !== "granted") {
          return { success: false, error: "location_background_denied" };
        }

        const notificationsPermission = await Notifications.requestPermissionsAsync();
        if (!notificationsPermission.granted) {
          return { success: false, error: "notifications_denied" };
        }
      }
    }

    let started: any;
    try {
      started = await startTripMutation({
        userId,
        origin: input.origin,
        destination: input.destination,
        deviationMaxMinutes: input.deviationMaxMinutes,
        opportunitiesEnabled: input.opportunitiesEnabled,
      });
    } catch {
      return { success: false, error: "trip_start_failed" };
    }

    const snapshot: ActiveSessionSnapshot = {
      tripSessionId: String(started.tripSessionId),
      destinationLabel: input.destination.label,
      deviationMaxMinutes: input.deviationMaxMinutes,
      startedAt: Date.now(),
      matchesCount: 0,
    };

    setLocalFallback(snapshot);
    await persistSnapshot(snapshot);

    try {
      await openNavigationApp({ lat: input.destination.lat, lng: input.destination.lng });
    } catch {
      // Trip is started even if external navigation app cannot open.
    }

    return { success: true };
  }, [persistSnapshot, startTripMutation, userId]);

  const stopTrip = useCallback(async () => {
    const current = activeSession;
    if (!current) return;

    await stopTripMutation({
      tripSessionId: current.tripSessionId,
      userId,
    });

    await stopTracking();
    setLocalFallback(null);
    await persistSnapshot(null);
  }, [activeSession, persistSnapshot, stopTracking, stopTripMutation, userId]);

  const value = useMemo(
    () => ({ activeSession, startTrip, stopTrip, setMatchesCount }),
    [activeSession, setMatchesCount, startTrip, stopTrip]
  );

  return <ActiveTripContext.Provider value={value}>{children}</ActiveTripContext.Provider>;
}

export function useActiveTrip() {
  return useContext(ActiveTripContext);
}
