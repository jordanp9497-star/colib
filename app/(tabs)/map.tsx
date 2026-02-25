import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useAction, useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/context/UserContext";
import { DetourFilter } from "@/components/maps/DetourFilter";
import { CrossPlatformMap } from "@/components/maps/CrossPlatformMap";
import type { MapPin } from "@/components/maps/CrossPlatformMap.types";
import { decodePolyline } from "@/utils/polyline";
import { Colors, Fonts } from "@/constants/theme";

export default function MapScreen() {
  const { userId } = useUser();
  const { height: screenHeight } = useWindowDimensions();
  const myTrips = useQuery(api.trips.getByUser, { userId });
  const parcels = useQuery(api.parcels.list);
  const recomputeForTrip = useMutation(api.matches.recomputeForTrip);
  const updateDetourLimit = useMutation(api.trips.updateDetourLimit);
  const getRoute = useAction(api.maps.getRoute);

  const [selectedDetour, setSelectedDetour] = useState(20);
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  const activeTrip = useMemo(() => myTrips?.find((t) => t.status === "published"), [myTrips]);
  const matches = useQuery(
    api.matches.listByTrip,
    activeTrip ? { tripId: activeTrip._id } : "skip"
  );

  const filteredMatches = useMemo(
    () => matches?.filter((match) => match.detourMinutes <= selectedDetour) ?? [],
    [matches, selectedDetour]
  );
  const mapHeight = Math.min(Math.max(300, Math.round(screenHeight * 0.52)), 420);
  const parcelById = useMemo(() => {
    if (!parcels) return new Map<string, any>();
    return new Map(parcels.map((parcel) => [String(parcel._id), parcel]));
  }, [parcels]);

  useEffect(() => {
    let cancelled = false;

    const fallback = () => {
      if (!activeTrip) return;
      setRouteCoordinates([
        { latitude: activeTrip.originAddress.lat, longitude: activeTrip.originAddress.lng },
        { latitude: activeTrip.destinationAddress.lat, longitude: activeTrip.destinationAddress.lng },
      ]);
    };

    if (!activeTrip) {
      setRouteCoordinates([]);
      return;
    }

    const loadRoute = async () => {
      try {
        const route = await getRoute({
          origin: { lat: activeTrip.originAddress.lat, lng: activeTrip.originAddress.lng },
          destination: { lat: activeTrip.destinationAddress.lat, lng: activeTrip.destinationAddress.lng },
        });
        if (cancelled) return;

        if (route?.polyline) {
          const decoded = decodePolyline(route.polyline).map((point) => ({
            latitude: point.lat,
            longitude: point.lng,
          }));
          if (decoded.length > 1) {
            setRouteCoordinates(decoded);
            return;
          }
        }

        if (route?.points && route.points.length > 1) {
          setRouteCoordinates(
            route.points.map((point) => ({
              latitude: point.lat,
              longitude: point.lng,
            }))
          );
          return;
        }

        fallback();
      } catch {
        if (!cancelled) fallback();
      }
    };

    void loadRoute();

    return () => {
      cancelled = true;
    };
  }, [activeTrip, getRoute]);

  const parcelMatches = useMemo(
    () =>
      filteredMatches
        .map((match) => ({ match, parcel: parcelById.get(String(match.parcelId)) }))
        .filter((entry) => Boolean(entry.parcel)),
    [filteredMatches, parcelById]
  );

  const clusteredPins = useMemo(() => {
    const step = 0.08;
    const buckets = new Map<string, { latitude: number; longitude: number; parcels: any[] }>();

    parcelMatches.forEach(({ parcel }) => {
      const latBucket = Math.round(parcel.originAddress.lat / step);
      const lngBucket = Math.round(parcel.originAddress.lng / step);
      const key = `${latBucket}:${lngBucket}`;
      const current = buckets.get(key);
      if (!current) {
        buckets.set(key, {
          latitude: parcel.originAddress.lat,
          longitude: parcel.originAddress.lng,
          parcels: [parcel],
        });
        return;
      }
      const nextCount = current.parcels.length + 1;
      current.latitude = (current.latitude * current.parcels.length + parcel.originAddress.lat) / nextCount;
      current.longitude = (current.longitude * current.parcels.length + parcel.originAddress.lng) / nextCount;
      current.parcels.push(parcel);
    });

    return Array.from(buckets.entries()).map(([bucketId, group]) => ({ bucketId, ...group }));
  }, [parcelMatches]);

  const clusterByPinId = useMemo(() => {
    const map = new Map<string, any[]>();
    clusteredPins.forEach((cluster) => {
      if (cluster.parcels.length <= 1) return;
      map.set(`cluster-${cluster.bucketId}`, cluster.parcels);
    });
    return map;
  }, [clusteredPins]);

  const mapPins = useMemo(() => {
    const pins: MapPin[] = clusteredPins.map((cluster) => {
      if (cluster.parcels.length === 1) {
        const parcel = cluster.parcels[0];
        return {
          id: `parcel-${parcel._id}`,
          latitude: parcel.originAddress.lat,
          longitude: parcel.originAddress.lng,
          title: `Colis: ${parcel.originAddress.city ?? parcel.origin}`,
          color: "#F4B740",
          kind: "parcel" as const,
        };
      }

      return {
        id: `cluster-${cluster.bucketId}`,
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        title: `${cluster.parcels.length} colis`,
        description: "Zone dense",
        color: Colors.dark.info,
        kind: "cluster" as const,
      };
    });

    if (activeTrip) {
      pins.unshift({
        id: `trip-origin-${activeTrip._id}`,
        latitude: activeTrip.originAddress.lat,
        longitude: activeTrip.originAddress.lng,
        title: "Depart trajet",
          color: Colors.dark.primary,
        kind: "trip-origin" as const,
      });
      pins.unshift({
        id: `trip-destination-${activeTrip._id}`,
        latitude: activeTrip.destinationAddress.lat,
        longitude: activeTrip.destinationAddress.lng,
        title: "Arrivee trajet",
          color: Colors.dark.success,
        kind: "trip-destination" as const,
      });
    }

    return pins;
  }, [activeTrip, clusteredPins]);

  const matchesWithParcel = parcelMatches;

  const openParcelDetails = (parcelId: string) => {
    router.push(`/parcel/${parcelId}` as any);
  };

  const handlePinPress = (pinId: string) => {
    setSelectedPinId(pinId);
  };

  const selectedClusterParcels = selectedPinId ? clusterByPinId.get(selectedPinId) ?? [] : [];
  const selectedParcelId = selectedPinId?.startsWith("parcel-") ? selectedPinId.replace("parcel-", "") : null;
  const selectedParcel = selectedParcelId ? parcelById.get(selectedParcelId) : null;
  const selectedIsTripPin = selectedPinId?.startsWith("trip-") ?? false;

  useEffect(() => {
    if (!selectedPinId) return;
    const stillVisible = mapPins.some((pin) => pin.id === selectedPinId);
    if (!stillVisible) {
      setSelectedPinId(null);
    }
  }, [mapPins, selectedPinId]);

  const mapPaths = useMemo(() => {
    if (!activeTrip || routeCoordinates.length < 2) return [];
    return [
      {
        id: `trip-path-${activeTrip._id}`,
        coordinates: routeCoordinates,
        color: Colors.dark.primary,
        width: 4,
      },
    ];
  }, [activeTrip, routeCoordinates]);

  const handleDetourChange = async (minutes: number) => {
    setSelectedDetour(minutes);
    if (!activeTrip) return;
    await updateDetourLimit({
      tripId: activeTrip._id,
      ownerVisitorId: userId,
      maxDetourMinutes: minutes,
    });
    await recomputeForTrip({ tripId: activeTrip._id });
  };

  if (myTrips === undefined) {
    return (
      <View style={styles.center}>
          <ActivityIndicator color={Colors.dark.primary} size="large" />
      </View>
    );
  }

  if (!activeTrip) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Publiez un trajet pour ouvrir la carte</Text>
        <Text style={styles.emptyText}>Ensuite vous verrez les colis compatibles en direct.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {router.canGoBack() ? (
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace("/(tabs)" as any)}>
          <Ionicons name="arrow-back" size={16} color={Colors.dark.textSecondary} />
          <Text style={styles.backButtonText}>Retour accueil</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.title}>Carte de matching</Text>
      <DetourFilter value={selectedDetour} onChange={handleDetourChange} />

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.dark.primary }]} />
          <Text style={styles.legendText}>Trajet</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#F4B740" }]} />
          <Text style={styles.legendText}>Pickup colis</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.dark.success }]} />
          <Text style={styles.legendText}>Drop trajet</Text>
        </View>
      </View>

      <View style={styles.mapWrap}>
        <CrossPlatformMap pins={mapPins} paths={mapPaths} height={mapHeight} onPinPress={handlePinPress} />
      </View>

      {selectedPinId ? (
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          {selectedParcel ? (
            <>
              <Text style={styles.sheetTitle}>Pin colis selectionne</Text>
              <Text style={styles.sheetSubtitle}>{selectedParcel.originAddress.city ?? selectedParcel.origin}</Text>
              <TouchableOpacity style={styles.sheetCta} onPress={() => openParcelDetails(String(selectedParcel._id))}>
                <Text style={styles.sheetCtaText}>Voir colis</Text>
              </TouchableOpacity>
            </>
          ) : selectedClusterParcels.length > 0 ? (
            <>
              <Text style={styles.sheetTitle}>Zone dense ({selectedClusterParcels.length} colis)</Text>
              <Text style={styles.sheetSubtitle}>Choisissez un colis de la zone pour ouvrir sa fiche.</Text>
              <View style={styles.sheetMiniList}>
                {selectedClusterParcels.slice(0, 3).map((parcel) => (
                  <TouchableOpacity
                    key={parcel._id}
                    style={styles.miniParcelButton}
                    onPress={() => openParcelDetails(String(parcel._id))}
                  >
                    <Text style={styles.miniParcelText} numberOfLines={1}>{parcel.originAddress.city ?? parcel.origin}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : selectedIsTripPin ? (
            <>
              <Text style={styles.sheetTitle}>Pin trajet selectionne</Text>
              <Text style={styles.sheetSubtitle}>Ouvrez le detail du trajet actif.</Text>
              <TouchableOpacity style={styles.sheetCta} onPress={() => router.push(`/trip/${activeTrip._id}` as any)}>
                <Text style={styles.sheetCtaText}>Voir trajet</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : null}

      <View style={styles.overlayPanel}>
        <Text style={styles.overlayTitle}>{filteredMatches.length} colis compatibles</Text>
        <View style={styles.overlayList}>
          {matchesWithParcel.map(({ match, parcel }) => (
            <TouchableOpacity key={match._id} style={styles.card} activeOpacity={0.85} onPress={() => openParcelDetails(String(parcel._id))}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {parcel.originAddress.city ?? "Point de recuperation"}
              </Text>
              <Text style={styles.cardLine} numberOfLines={1}>
                {parcel.origin}
              </Text>
              <Text style={styles.cardMeta}>Detour {match.detourMinutes} min - Score {match.score}</Text>
              <Text style={styles.price}>{match.pricingEstimate.totalAmount} EUR</Text>
            </TouchableOpacity>
          ))}
          {filteredMatches.length === 0 ? (
            <Text style={styles.emptyText}>Aucun colis compatible pour ce seuil.</Text>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 28,
  },
  title: {
    fontSize: 22,
    color: Colors.dark.text,
    fontFamily: Fonts.displaySemiBold,
    marginBottom: 12,
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
    marginBottom: 8,
    backgroundColor: Colors.dark.surface,
  },
  backButtonText: { fontSize: 12, color: Colors.dark.textSecondary, fontFamily: Fonts.sansSemiBold },
  mapWrap: {
    marginTop: 12,
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: -2,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.dark.surfaceMuted,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
  },
  legendText: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontFamily: Fonts.sansSemiBold,
  },
  bottomSheet: {
    marginTop: 2,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    padding: 12,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.dark.border,
    marginBottom: 10,
  },
  sheetTitle: {
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  sheetSubtitle: {
    marginTop: 4,
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
  sheetCta: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCtaText: {
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  sheetMiniList: {
    marginTop: 10,
    gap: 8,
  },
  miniParcelButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  miniParcelText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  overlayPanel: {
    marginTop: 2,
  },
  overlayTitle: {
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    marginBottom: 6,
  },
  overlayList: {
    gap: 8,
    paddingBottom: 10,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    width: "100%",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.dark.text,
    marginBottom: 3,
  },
  cardLine: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  cardMeta: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  price: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: "700",
    color: Colors.dark.primary,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: Colors.dark.background,
  },
  emptyTitle: {
    fontSize: 18,
    color: Colors.dark.text,
    fontFamily: Fonts.displaySemiBold,
    textAlign: "center",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
});
