import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { api } from "@/convex/_generated/api";
import { DetourFilter } from "@/components/maps/DetourFilter";
import { CrossPlatformMap } from "@/components/maps/CrossPlatformMap";
import { BackButton } from "@/components/ui/back-button";
import { SurfaceCard } from "@/components/ui/surface-card";
import StarRating from "@/components/profile/StarRating";
import { Colors, Fonts } from "@/constants/theme";

type SortBy = "best" | "soonest" | "detour" | "price";

type TripPreview = {
  _id: string;
  origin: string;
  destination: string;
  userName: string;
  originAddress: { lat: number; lng: number; city?: string };
  carrierProfile?: {
    name: string;
    profilePhotoUrl: string | null;
    averageRating: number | null;
    totalReviews: number;
  };
};

export default function ParcelMatchScreen() {
  const params = useLocalSearchParams<{ parcelId: string }>();
  const parcelId = params.parcelId as any;
  const [detourLimit, setDetourLimit] = useState(20);
  const [sortBy, setSortBy] = useState<SortBy>("best");
  const recompute = useMutation(api.matches.recomputeForParcel);

  const parcel = useQuery(api.parcels.getById, parcelId ? { parcelId } : "skip");
  const matches = useQuery(api.matches.listByParcel, parcelId ? { parcelId } : "skip");
  const trips = useQuery(api.trips.list) as TripPreview[] | undefined;

  const tripById = useMemo(
    () => new Map((trips ?? []).map((trip) => [String(trip._id), trip])),
    [trips]
  );

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
    const pins: { id: string; latitude: number; longitude: number; title: string; color: string }[] = [];
    if (parcel) {
        pins.push({
          id: `parcel-origin-${parcel._id}`,
          latitude: parcel.originAddress.lat,
          longitude: parcel.originAddress.lng,
          title: "Depart colis",
          color: Colors.dark.error,
        });
      pins.push({
        id: `parcel-destination-${parcel._id}`,
        latitude: parcel.destinationAddress.lat,
          longitude: parcel.destinationAddress.lng,
          title: "Destination colis",
          color: Colors.dark.error,
        });
    }

    for (const match of sorted) {
      const trip = tripById.get(String(match.tripId));
      if (!trip) continue;
      pins.push({
        id: `trip-origin-${trip._id}`,
        latitude: trip.originAddress.lat,
        longitude: trip.originAddress.lng,
        title: `Trajet ${trip.originAddress.city ?? trip.origin}`,
        color: Colors.dark.primary,
      });
    }

    return pins;
  }, [parcel, sorted, tripById]);

  const mapPaths = useMemo(() => {
    const paths: { id: string; coordinates: { latitude: number; longitude: number }[]; color: string; width: number }[] = [];
    if (parcel) {
      paths.push({
        id: `parcel-path-${parcel._id}`,
        coordinates: [
          { latitude: parcel.originAddress.lat, longitude: parcel.originAddress.lng },
          { latitude: parcel.destinationAddress.lat, longitude: parcel.destinationAddress.lng },
        ],
        color: Colors.dark.error,
        width: 3,
      });
    }
    return paths;
  }, [parcel]);

  if (parcel === undefined || matches === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.dark.primary} size="large" />
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
      <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as any))} />

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
          <SurfaceCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aucun match pour le moment</Text>
            <Text style={styles.emptyText}>
              Votre colis reste publie. Vous pouvez attendre de nouveaux trajets ou ajuster la date/les preferences.
            </Text>
          </SurfaceCard>
        }
        renderItem={({ item }) => (
          <SurfaceCard style={styles.card}>
            {(() => {
              const trip = tripById.get(String(item.tripId));
              const carrierName = trip?.carrierProfile?.name ?? trip?.userName ?? "Transporteur";
              const carrierPhoto = trip?.carrierProfile?.profilePhotoUrl ?? null;

              return (
                <>
                  <View style={styles.carrierRow}>
                    {carrierPhoto ? (
                      <Image source={{ uri: carrierPhoto }} style={styles.carrierAvatar} />
                    ) : (
                      <View style={styles.carrierAvatarFallback}>
                        <Text style={styles.carrierAvatarText}>
                          {carrierName.trim().charAt(0).toUpperCase() || "?"}
                        </Text>
                      </View>
                    )}
                    <View style={styles.carrierMeta}>
                      <Text style={styles.carrierName} numberOfLines={1}>
                        {carrierName}
                      </Text>
                      <StarRating
                        rating={trip?.carrierProfile?.averageRating}
                        totalReviews={trip?.carrierProfile?.totalReviews ?? 0}
                        size={12}
                        color={Colors.dark.warning}
                      />
                    </View>
                  </View>
                  {trip ? (
                    <Text style={styles.cardLine} numberOfLines={1}>
                      {trip.origin} {" -> "} {trip.destination}
                    </Text>
                  ) : null}
                  <Text style={styles.cardTitle}>Score {item.score}/100</Text>
                  <Text style={styles.cardLine}>{item.detourMinutes} min ({item.detourDistanceKm} km)</Text>
                  <Text style={styles.cardLine}>{item.rankingReason}</Text>
                  <Text style={styles.price}>{item.pricingEstimate.totalAmount} EUR</Text>
                </>
              );
            })()}
          </SurfaceCard>
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
    padding: 12,
  },
  carrierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  carrierAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.dark.surfaceMuted,
  },
  carrierAvatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surfaceMuted,
  },
  carrierAvatarText: {
    fontSize: 12,
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
  },
  carrierMeta: {
    flex: 1,
    minWidth: 0,
  },
  carrierName: {
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  cardTitle: { fontSize: 14, color: Colors.dark.text, marginBottom: 4, fontFamily: Fonts.sansSemiBold },
  cardLine: { fontSize: 13, color: Colors.dark.textSecondary, fontFamily: Fonts.sans },
  price: { marginTop: 6, fontSize: 15, color: Colors.dark.primary, fontFamily: Fonts.sansSemiBold },
  emptyCard: {
    marginTop: 20,
    padding: 14,
  },
  emptyTitle: { fontSize: 15, color: Colors.dark.text, fontFamily: Fonts.sansSemiBold },
  emptyText: { marginTop: 6, fontSize: 13, color: Colors.dark.textSecondary, fontFamily: Fonts.sans },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.dark.background },
});
