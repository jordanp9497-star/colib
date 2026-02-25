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

  const mapPins = useMemo(() => {
    const matchedIds = new Set(filteredMatches.map((m) => String(m.parcelId)));
    const pins: MapPin[] = (parcels ?? [])
      .filter((parcel) => matchedIds.has(String(parcel._id)))
      .map((parcel) => ({
        id: `parcel-${parcel._id}`,
        latitude: parcel.originAddress.lat,
        longitude: parcel.originAddress.lng,
        title: `Colis a recuperer: ${parcel.originAddress.city ?? parcel.origin}`,
          color: "#F4B740",
        kind: "parcel" as const,
      }));

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
  }, [activeTrip, filteredMatches, parcels]);

  const matchesWithParcel = useMemo(
    () =>
      filteredMatches
        .map((match) => ({ match, parcel: parcelById.get(String(match.parcelId)) }))
        .filter((entry) => Boolean(entry.parcel)),
    [filteredMatches, parcelById]
  );

  const openParcelDetails = (parcelId: string) => {
    router.push(`/parcel/${parcelId}` as any);
  };

  const handlePinPress = (pinId: string) => {
    if (!pinId.startsWith("parcel-")) return;
    openParcelDetails(pinId.replace("parcel-", ""));
  };

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {router.canGoBack() ? (
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={16} color={Colors.dark.textSecondary} />
          <Text style={styles.backButtonText}>Precedent</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.title}>Carte de matching</Text>
      <DetourFilter value={selectedDetour} onChange={handleDetourChange} />

      <View style={styles.mapWrap}>
        <CrossPlatformMap pins={mapPins} paths={mapPaths} height={mapHeight} onPinPress={handlePinPress} />
      </View>

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
