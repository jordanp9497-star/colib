import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/convex/_generated/api";
import { DetourFilter } from "@/components/maps/DetourFilter";
import { CrossPlatformMap } from "@/components/maps/CrossPlatformMap";
import { Colors, Fonts } from "@/constants/theme";

type SortBy = "best" | "soonest" | "detour" | "price";

export default function ParcelMatchScreen() {
  const params = useLocalSearchParams<{ parcelId: string }>();
  const parcelId = params.parcelId as any;
  const [detourLimit, setDetourLimit] = useState(20);
  const [sortBy, setSortBy] = useState<SortBy>("best");
  const recompute = useMutation(api.matches.recomputeForParcel);

  const parcel = useQuery(api.parcels.getById, parcelId ? { parcelId } : "skip");
  const matches = useQuery(api.matches.listByParcel, parcelId ? { parcelId } : "skip");
  const trips = useQuery(api.trips.list);

  const sorted = useMemo(() => {
    const list = (matches ?? []).filter((m) => m.detourMinutes <= detourLimit);
    if (sortBy === "detour") return [...list].sort((a, b) => a.detourMinutes - b.detourMinutes);
    if (sortBy === "price") {
      return [...list].sort((a, b) => a.pricingEstimate.totalAmount - b.pricingEstimate.totalAmount);
    }
    if (sortBy === "soonest") return [...list].sort((a, b) => b.createdAt - a.createdAt);
    return [...list].sort((a, b) => b.score - a.score);
  }, [detourLimit, matches, sortBy]);

  const mapPins = useMemo(() => {
    const pins: Array<{ id: string; latitude: number; longitude: number; title: string; color: string }> = [];
    if (parcel) {
      pins.push({
        id: `parcel-origin-${parcel._id}`,
        latitude: parcel.originAddress.lat,
        longitude: parcel.originAddress.lng,
        title: "Depart colis",
        color: "#DC2626",
      });
      pins.push({
        id: `parcel-destination-${parcel._id}`,
        latitude: parcel.destinationAddress.lat,
        longitude: parcel.destinationAddress.lng,
        title: "Destination colis",
        color: "#B91C1C",
      });
    }

    const tripById = new Map((trips ?? []).map((trip) => [trip._id, trip]));
    for (const match of sorted) {
      const trip = tripById.get(match.tripId);
      if (!trip) continue;
      pins.push({
        id: `trip-origin-${trip._id}`,
        latitude: trip.originAddress.lat,
        longitude: trip.originAddress.lng,
        title: `Trajet ${trip.originAddress.city ?? trip.origin}`,
        color: "#2563EB",
      });
    }

    return pins;
  }, [parcel, sorted, trips]);

  const mapPaths = useMemo(() => {
    const paths: Array<{ id: string; coordinates: Array<{ latitude: number; longitude: number }>; color: string; width: number }> = [];
    if (parcel) {
      paths.push({
        id: `parcel-path-${parcel._id}`,
        coordinates: [
          { latitude: parcel.originAddress.lat, longitude: parcel.originAddress.lng },
          { latitude: parcel.destinationAddress.lat, longitude: parcel.destinationAddress.lng },
        ],
        color: "#B91C1C",
        width: 3,
      });
    }
    return paths;
  }, [parcel]);

  if (parcel === undefined || matches === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4338CA" size="large" />
      </View>
    );
  }

  const handleDetour = async (minutes: number) => {
    setDetourLimit(minutes);
    if (parcelId) {
      await recompute({ parcelId });
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as any))}
      >
        <Ionicons name="arrow-back" size={16} color={Colors.dark.textSecondary} />
        <Text style={styles.backButtonText}>Retour</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Matches colis</Text>
      <Text style={styles.subtitle}>{`${parcel?.origin ?? ""} -> ${parcel?.destination ?? ""}`}</Text>

      <DetourFilter value={detourLimit} onChange={handleDetour} />

      <View style={styles.sortRow}>
        {([
          ["best", "Meilleur"],
          ["soonest", "Plus tot"],
          ["detour", "Moins de detour"],
          ["price", "Prix"],
        ] as const).map(([value, label]) => (
          <Text
            key={value}
            style={[styles.sortChip, sortBy === value && styles.sortChipActive]}
            onPress={() => setSortBy(value)}
          >
            {label}
          </Text>
        ))}
      </View>

      <CrossPlatformMap pins={mapPins} paths={mapPaths} height={280} />

      <FlatList
        data={sorted}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aucun match pour le moment</Text>
            <Text style={styles.emptyText}>
              Votre colis reste publie. Vous pouvez attendre de nouveaux trajets ou ajuster la date/les preferences.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Score {item.score}/100</Text>
            <Text style={styles.cardLine}>{item.detourMinutes} min ({item.detourDistanceKm} km)</Text>
            <Text style={styles.cardLine}>{item.rankingReason}</Text>
            <Text style={styles.price}>{item.pricingEstimate.totalAmount} EUR</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background, padding: 16, paddingTop: 56 },
  title: { fontSize: 24, color: Colors.dark.text, fontFamily: Fonts.displaySemiBold },
  subtitle: { marginTop: 4, marginBottom: 12, fontSize: 13, color: Colors.dark.textSecondary, fontFamily: Fonts.sans },
  sortRow: { flexDirection: "row", gap: 8, marginVertical: 12, flexWrap: "wrap" },
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
    marginBottom: 10,
    backgroundColor: "#161D24",
  },
  backButtonText: { fontSize: 12, color: Colors.dark.textSecondary, fontFamily: Fonts.sansSemiBold },
  sortChip: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  sortChipActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primaryLight,
    color: Colors.dark.text,
  },
  list: { paddingTop: 12, gap: 8, paddingBottom: 30 },
  card: {
    backgroundColor: Colors.dark.surface,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  cardTitle: { fontSize: 14, color: Colors.dark.text, marginBottom: 4, fontFamily: Fonts.sansSemiBold },
  cardLine: { fontSize: 13, color: Colors.dark.textSecondary, fontFamily: Fonts.sans },
  price: { marginTop: 6, fontSize: 15, color: Colors.dark.primary, fontFamily: Fonts.sansSemiBold },
  emptyCard: {
    marginTop: 20,
    borderRadius: 12,
    padding: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  emptyTitle: { fontSize: 15, color: Colors.dark.text, fontFamily: Fonts.sansSemiBold },
  emptyText: { marginTop: 6, fontSize: 13, color: Colors.dark.textSecondary, fontFamily: Fonts.sans },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.dark.background },
});
