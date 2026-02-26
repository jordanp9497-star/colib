import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "@/convex/_generated/api";
import { buildDayWindowTimestamps } from "@/components/forms/TimeWindowInput";
import { FILTER_STORAGE_KEY, LAST_SEARCH_STORAGE_KEY, SEARCH_RADIUS_KM } from "@/constants/searchFlow";
import { Colors, Fonts } from "@/constants/theme";
import { useSearchFlow, type PersistedSearch, type TripListItem } from "@/context/SearchFlowContext";
import { setPersistedItem, setSessionItem } from "@/utils/clientStorage";

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.sqrt(h));
}

function isOnSameDay(timestamp: number, dayTs: number) {
  const left = new Date(timestamp);
  const right = new Date(dayTs);
  return (
    left.getDate() === right.getDate() &&
    left.getMonth() === right.getMonth() &&
    left.getFullYear() === right.getFullYear()
  );
}

export default function MatchingScreen() {
  const trips = useQuery(api.trips.list) as TripListItem[] | undefined;
  const { searchQuery, completeSearch, status } = useSearchFlow();

  useEffect(() => {
    if (!searchQuery || !searchQuery.destinationZone) {
      router.replace("/(tabs)" as any);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (!searchQuery || !searchQuery.destinationZone || trips === undefined || status !== "matching") {
      return;
    }

    const publishedTrips = (trips ?? []).filter((trip) => trip.status === "published");
    const destinationZone = searchQuery.destinationZone;
    const dayWindow = searchQuery.dateValue.trim()
      ? buildDayWindowTimestamps(searchQuery.dateValue.trim())
      : null;

    const filtered = publishedTrips.filter((trip) => {
      const arrivalDistance = haversineKm(
        { lat: trip.destinationAddress.lat, lng: trip.destinationAddress.lng },
        { lat: destinationZone.lat, lng: destinationZone.lng }
      );
      if (arrivalDistance > SEARCH_RADIUS_KM) {
        return false;
      }

      if (searchQuery.originZone) {
        const departureDistance = haversineKm(
          { lat: trip.originAddress.lat, lng: trip.originAddress.lng },
          { lat: searchQuery.originZone.lat, lng: searchQuery.originZone.lng }
        );
        if (departureDistance > SEARCH_RADIUS_KM) {
          return false;
        }
      }

      if (dayWindow) {
        const ts = trip.windowStartTs;
        if (!ts) return false;
        return isOnSameDay(ts, dayWindow.windowStartTs);
      }

      return true;
    });

    const persist = async () => {
      const persistedPayload: PersistedSearch = {
        originZone: searchQuery.originZone,
        destinationZone: searchQuery.destinationZone,
        dateValue: searchQuery.dateValue,
        showAdvancedFilters: searchQuery.showAdvancedFilters,
        searchedAt: Date.now(),
        resultCount: filtered.length,
      };
      await setPersistedItem(FILTER_STORAGE_KEY, JSON.stringify(persistedPayload));
      await setPersistedItem(LAST_SEARCH_STORAGE_KEY, JSON.stringify(persistedPayload));
      setSessionItem(LAST_SEARCH_STORAGE_KEY, JSON.stringify(persistedPayload));
    };

    void persist();
    completeSearch(filtered);
    router.replace("/search/results" as any);
  }, [completeSearch, searchQuery, status, trips]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.dark.primary} />
      <Text style={styles.title}>Matching en cours...</Text>
      <Text style={styles.subtitle}>Nous recherchons les trajets les plus proches de votre demande.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: Colors.dark.background,
  },
  title: {
    marginTop: 14,
    color: Colors.dark.text,
    fontSize: 18,
    fontFamily: Fonts.displaySemiBold,
  },
  subtitle: {
    marginTop: 8,
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    fontFamily: Fonts.sans,
  },
});
