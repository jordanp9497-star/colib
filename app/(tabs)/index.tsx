import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/convex/_generated/api";
import TripCard from "@/components/TripCard";
import { AddressAutocompleteInput } from "@/components/maps/AddressAutocompleteInput";
import { buildDayWindowTimestamps } from "@/components/forms/TimeWindowInput";
import type { GeocodedAddress } from "@/packages/shared/maps";
import { useActiveTrip } from "@/context/ActiveTripContext";
import { ColibLogoMark } from "@/components/branding/ColibLogoMark";
import { Colors, Fonts, Typography } from "@/constants/theme";
import { getPersistedItem, getSessionItem, setPersistedItem, setSessionItem } from "@/utils/clientStorage";

const SEARCH_RADIUS_KM = 30;
const FILTER_STORAGE_KEY = "colib_home_filters_v1";
const LAST_SEARCH_STORAGE_KEY = "colib_home_last_search_v1";

type TripListItem = {
  _id: string;
  origin: string;
  destination: string;
  date: string;
  availableSpace: "petit" | "moyen" | "grand";
  price: number;
  description?: string;
  phone?: string;
  userName: string;
  originAddress: { lat: number; lng: number; label?: string; city?: string; postalCode?: string };
  destinationAddress: { lat: number; lng: number; label?: string; city?: string; postalCode?: string };
  windowStartTs?: number;
  status: string;
};

type PersistedSearch = {
  originZone: GeocodedAddress | null;
  destinationZone: GeocodedAddress | null;
  dateValue: string;
  showAdvancedFilters: boolean;
  searchedAt: number;
  resultCount: number;
};

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

export default function TripsScreen() {
  const { activeSession } = useActiveTrip();
  const trips = useQuery(api.trips.list) as TripListItem[] | undefined;
  const [originZone, setOriginZone] = useState<GeocodedAddress | null>(null);
  const [destinationZone, setDestinationZone] = useState<GeocodedAddress | null>(null);
  const [dateValue, setDateValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<TripListItem[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [isHydratingFilters, setIsHydratingFilters] = useState(true);
  const [lastSearch, setLastSearch] = useState<PersistedSearch | null>(null);

  const publishedTrips = useMemo(
    () => (trips ?? []).filter((trip) => trip.status === "published"),
    [trips]
  );

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      try {
        const persistedFilters = await getPersistedItem(FILTER_STORAGE_KEY);
        if (persistedFilters && mounted) {
          const parsed = JSON.parse(persistedFilters) as Partial<PersistedSearch>;
          setOriginZone(parsed.originZone ?? null);
          setDestinationZone(parsed.destinationZone ?? null);
          setDateValue(parsed.dateValue ?? "");
          setShowAdvancedFilters(Boolean(parsed.showAdvancedFilters || parsed.originZone || parsed.dateValue));
        }

        const persistedSessionSearch = getSessionItem(LAST_SEARCH_STORAGE_KEY);
        const persistedSearch = persistedSessionSearch ?? (await getPersistedItem(LAST_SEARCH_STORAGE_KEY));
        if (persistedSearch && mounted) {
          setLastSearch(JSON.parse(persistedSearch) as PersistedSearch);
        }
      } catch {
        if (!mounted) return;
      } finally {
        if (mounted) setIsHydratingFilters(false);
      }
    };

    void hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  const runSearch = async ({
    nextOriginZone,
    nextDestinationZone,
    nextDateValue,
    nextShowAdvancedFilters,
  }: {
    nextOriginZone: GeocodedAddress | null;
    nextDestinationZone: GeocodedAddress | null;
    nextDateValue: string;
    nextShowAdvancedFilters: boolean;
  }) => {
    if (!nextDestinationZone) {
      Alert.alert("Destination requise", "Ajoutez une zone d'arrivee pour lancer la recherche.");
      return;
    }

    const dayWindow = nextDateValue.trim()
      ? buildDayWindowTimestamps(nextDateValue.trim())
      : null;

    if (nextDateValue.trim() && !dayWindow) {
      Alert.alert("Date invalide", "Utilisez le format JJ/MM/AAAA ou laissez vide.");
      return;
    }

    const filtered = publishedTrips.filter((trip) => {
      const arrivalDistance = haversineKm(
        { lat: trip.destinationAddress.lat, lng: trip.destinationAddress.lng },
        { lat: nextDestinationZone.lat, lng: nextDestinationZone.lng }
      );
      if (arrivalDistance > SEARCH_RADIUS_KM) {
        return false;
      }

      if (nextOriginZone) {
        const departureDistance = haversineKm(
          { lat: trip.originAddress.lat, lng: trip.originAddress.lng },
          { lat: nextOriginZone.lat, lng: nextOriginZone.lng }
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

    setResults(filtered);
    setSubmitted(true);

    const persistedPayload: PersistedSearch = {
      originZone: nextOriginZone,
      destinationZone: nextDestinationZone,
      dateValue: nextDateValue,
      showAdvancedFilters: nextShowAdvancedFilters,
      searchedAt: Date.now(),
      resultCount: filtered.length,
    };

    setLastSearch(persistedPayload);
    await setPersistedItem(FILTER_STORAGE_KEY, JSON.stringify(persistedPayload));
    await setPersistedItem(LAST_SEARCH_STORAGE_KEY, JSON.stringify(persistedPayload));
    setSessionItem(LAST_SEARCH_STORAGE_KEY, JSON.stringify(persistedPayload));
  };

  const handleSearch = async () => {
    await runSearch({
      nextOriginZone: originZone,
      nextDestinationZone: destinationZone,
      nextDateValue: dateValue,
      nextShowAdvancedFilters: showAdvancedFilters,
    });
  };

  const handleRelaunchSearch = async () => {
    if (!lastSearch) return;
    setOriginZone(lastSearch.originZone);
    setDestinationZone(lastSearch.destinationZone);
    setDateValue(lastSearch.dateValue);
    setShowAdvancedFilters(lastSearch.showAdvancedFilters);
    await runSearch({
      nextOriginZone: lastSearch.originZone,
      nextDestinationZone: lastSearch.destinationZone,
      nextDateValue: lastSearch.dateValue,
      nextShowAdvancedFilters: lastSearch.showAdvancedFilters,
    });
  };

  const listData = submitted ? results : [];
  const isIdleListState = viewMode === "list" && !submitted;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoWrap}>
            <ColibLogoMark size={36} color="#EAF0F6" backgroundColor="#161D24" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Colib</Text>
            <Text style={styles.tagline}>transportez où vous voulez, quand vous voulez.</Text>
          </View>
        </View>
      </View>

      <View style={[styles.searchContainerWrap, isIdleListState && styles.searchContainerWrapIdle]}>
      <View style={styles.tripAssistCard}>
        <View style={styles.tripAssistHeader}>
          <Ionicons name="navigate-circle-outline" size={18} color={Colors.dark.primary} />
          <Text style={styles.tripAssistTitle}>Mode conducteur</Text>
        </View>
        <Text style={styles.tripAssistText}>
          Demarrez un trajet avec Waze et analysez automatiquement les colis sur votre chemin.
        </Text>
        <TouchableOpacity
          style={[styles.primaryAction, activeSession && styles.primaryActionDisabled]}
          onPress={() => router.push("/trip/start" as any)}
          disabled={Boolean(activeSession)}
          activeOpacity={0.88}
        >
          <Ionicons name={activeSession ? "checkmark-circle-outline" : "play-circle-outline"} size={17} color={Colors.dark.text} />
          <Text style={styles.primaryActionText}>
            {activeSession ? "Trajet actif en cours" : "Demarrer un trajet avec Waze"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        {router.canGoBack() ? (
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace("/(tabs)" as any)}>
            <Ionicons name="arrow-back" size={16} color={Colors.dark.textSecondary} />
            <Text style={styles.backButtonText}>Retour accueil</Text>
          </TouchableOpacity>
        ) : null}

        <AddressAutocompleteInput
          label="Destination"
          placeholder="Ville ou adresse d'arrivee"
          value={destinationZone}
          onChange={setDestinationZone}
        />

        <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvancedFilters((value) => !value)}>
          <Ionicons name={showAdvancedFilters ? "remove-circle-outline" : "add-circle-outline"} size={16} color={Colors.dark.primary} />
          <Text style={styles.advancedToggleText}>{showAdvancedFilters ? "Masquer les filtres" : "Ajouter des filtres"}</Text>
        </TouchableOpacity>

        {showAdvancedFilters ? (
          <>
            <AddressAutocompleteInput
              label="Zone de depart (optionnel)"
              placeholder="Ville ou adresse de depart"
              value={originZone}
              onChange={setOriginZone}
            />
            <Text style={styles.inputLabel}>Date (optionnelle)</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="JJ/MM/AAAA"
              placeholderTextColor={Colors.dark.textSecondary}
              value={dateValue}
              onChangeText={setDateValue}
            />
          </>
        ) : null}

        <TouchableOpacity style={styles.searchButton} onPress={() => void handleSearch()} activeOpacity={0.9}>
          <Text style={styles.searchButtonText}>Rechercher des trajets</Text>
        </TouchableOpacity>

        {lastSearch ? (
          <TouchableOpacity style={styles.relaunchButton} onPress={() => void handleRelaunchSearch()} activeOpacity={0.9}>
            <Ionicons name="refresh-outline" size={14} color={Colors.dark.text} />
            <Text style={styles.relaunchButtonText}>Relancer la derniere recherche</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.viewModeRow}>
          <TouchableOpacity
            style={[styles.viewModeChip, viewMode === "list" && styles.viewModeChipActive]}
            onPress={() => setViewMode("list")}
          >
            <Text style={[styles.viewModeText, viewMode === "list" && styles.viewModeTextActive]}>Liste</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeChip, viewMode === "map" && styles.viewModeChipActive]}
            onPress={() => setViewMode("map")}
          >
            <Text style={[styles.viewModeText, viewMode === "map" && styles.viewModeTextActive]}>Carte</Text>
          </TouchableOpacity>
        </View>
      </View>
      </View>

      {trips === undefined || isHydratingFilters ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2].map((row) => (
            <View key={`skeleton-${row}`} style={styles.skeletonCard}>
              <View style={[styles.skeletonLine, styles.skeletonLineWide]} />
              <View style={[styles.skeletonLine, styles.skeletonLineMedium]} />
              <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
            </View>
          ))}
        </View>
      ) : viewMode === "map" ? (
        <View style={styles.center}>
          <Ionicons name="map-outline" size={24} color={Colors.dark.textSecondary} />
          <Text style={styles.emptyTitle}>Vue carte</Text>
          <Text style={styles.emptyText}>Consultez les colis compatibles sur la carte conducteur.</Text>
          <TouchableOpacity style={styles.openMapButton} onPress={() => router.push("/(tabs)/map" as any)}>
            <Text style={styles.openMapButtonText}>Ouvrir la carte</Text>
          </TouchableOpacity>
        </View>
      ) : listData.length > 0 ? (
        <>
          <View style={styles.resultsMetaWrap}>
            <Text style={styles.resultsMetaText}>{listData.length} trajets trouves</Text>
          </View>
          <FlatList
            data={listData}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity activeOpacity={0.86} onPress={() => router.push(`/trip/${item._id}` as any)}>
                <TripCard trip={item} />
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </>
      ) : submitted ? (
        <View style={styles.center}>
          <Text style={styles.resultsMetaText}>0 trajet trouve</Text>
          <Ionicons name="car-outline" size={24} color={Colors.dark.textSecondary} />
          <Text style={styles.emptyTitle}>Aucun trajet trouve</Text>
          <Text style={styles.emptyText}>
            Elargissez la zone ou retirez les filtres pour voir plus d&apos;annonces.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 10,
    backgroundColor: Colors.dark.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    color: Colors.dark.text,
    fontFamily: Fonts.displaySemiBold,
  },
  tagline: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sans,
    textTransform: "none",
  },
  searchContainer: {
    width: "100%",
    maxWidth: 680,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  searchContainerWrap: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
    alignItems: "center",
  },
  searchContainerWrapIdle: {
    flex: 1,
    justifyContent: "center",
    paddingTop: 8,
    paddingBottom: 24,
  },
  tripAssistCard: {
    width: "100%",
    maxWidth: 680,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    gap: 8,
  },
  tripAssistHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tripAssistTitle: {
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  tripAssistText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.sans,
  },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 2,
    backgroundColor: Colors.dark.surface,
  },
  backButtonText: { fontSize: 12, fontFamily: Fonts.sansSemiBold, color: Colors.dark.textSecondary },
  primaryAction: {
    width: "100%",
    alignSelf: "center",
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginBottom: 2,
    flexDirection: "row",
    gap: 8,
  },
  primaryActionDisabled: {
    backgroundColor: "#475467",
  },
  primaryActionText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontFamily: Fonts.sansSemiBold,
  },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  advancedToggleText: {
    color: Colors.dark.primary,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  inputLabel: {
    marginTop: -2,
    marginBottom: -4,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
  },
  searchInput: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.dark.text,
    fontFamily: Fonts.sans,
  },
  searchButton: {
    marginTop: 2,
    backgroundColor: Colors.dark.secondary,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  searchButtonText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  relaunchButton: {
    marginTop: -4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  relaunchButtonText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  viewModeRow: {
    flexDirection: "row",
    gap: 8,
  },
  viewModeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  viewModeChipActive: {
    backgroundColor: Colors.dark.primaryLight,
    borderColor: Colors.dark.primary,
  },
  viewModeText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  viewModeTextActive: {
    color: Colors.dark.text,
  },
  openMapButton: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  openMapButtonText: {
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  resultsMetaWrap: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  resultsMetaText: {
    color: Colors.dark.success,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  list: {
    padding: 20,
  },
  skeletonList: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  skeletonCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    padding: 14,
    gap: 10,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 999,
    backgroundColor: Colors.dark.surfaceMuted,
  },
  skeletonLineWide: {
    width: "82%",
  },
  skeletonLineMedium: {
    width: "62%",
  },
  skeletonLineShort: {
    width: "45%",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    ...Typography.h1,
    color: Colors.dark.text,
    marginTop: 10,
    marginBottom: 8,
    fontFamily: Fonts.displaySemiBold,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    fontFamily: Fonts.sans,
  },
});
