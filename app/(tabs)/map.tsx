import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/context/UserContext";
import { DetourFilter } from "@/components/maps/DetourFilter";
import { CrossPlatformMap } from "@/components/maps/CrossPlatformMap";
import { decodePolyline } from "@/utils/polyline";

export default function MapScreen() {
  const { userId } = useUser();
  const { height: screenHeight } = useWindowDimensions();
  const myTrips = useQuery(api.trips.getByUser, { userId });
  const parcels = useQuery(api.parcels.list);
  const recomputeForTrip = useMutation(api.matches.recomputeForTrip);
  const updateDetourLimit = useMutation(api.trips.updateDetourLimit);
  const getRoute = useAction(api.maps.getRoute);

  const [selectedDetour, setSelectedDetour] = useState(20);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);

  const activeTrip = useMemo(() => myTrips?.find((t) => t.status === "published"), [myTrips]);
  const matches = useQuery(
    api.matches.listByTrip,
    activeTrip ? { tripId: activeTrip._id } : "skip"
  );

  const filteredMatches = matches?.filter((match) => match.detourMinutes <= selectedDetour) ?? [];
  const mapHeight = Math.min(Math.max(300, Math.round(screenHeight * 0.52)), 420);

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
  }, [
    activeTrip?._id,
    activeTrip?.originAddress.lat,
    activeTrip?.originAddress.lng,
    activeTrip?.destinationAddress.lat,
    activeTrip?.destinationAddress.lng,
    getRoute,
  ]);

  const mapPins = useMemo(() => {
    if (!parcels) return [] as Array<{ id: string; latitude: number; longitude: number; title: string; color: string }>;
    const matchedIds = new Set(filteredMatches.map((m) => m.parcelId));
    const pins = parcels
      .filter((parcel) => matchedIds.has(parcel._id))
      .map((parcel) => ({
        id: `parcel-${parcel._id}`,
        latitude: parcel.originAddress.lat,
        longitude: parcel.originAddress.lng,
        title: `Colis: ${parcel.originAddress.city ?? parcel.origin}`,
        color: "#DC2626",
      }));

    if (activeTrip) {
      pins.unshift({
        id: `trip-origin-${activeTrip._id}`,
        latitude: activeTrip.originAddress.lat,
        longitude: activeTrip.originAddress.lng,
        title: "Depart trajet",
        color: "#1D4ED8",
      });
      pins.unshift({
        id: `trip-destination-${activeTrip._id}`,
        latitude: activeTrip.destinationAddress.lat,
        longitude: activeTrip.destinationAddress.lng,
        title: "Arrivee trajet",
        color: "#16A34A",
      });
    }

    return pins;
  }, [activeTrip, filteredMatches, parcels]);

  const mapPaths = useMemo(() => {
    if (!activeTrip || routeCoordinates.length < 2) return [];
    return [
      {
        id: `trip-path-${activeTrip._id}`,
        coordinates: routeCoordinates,
        color: "#2563EB",
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
        <ActivityIndicator color="#4338CA" size="large" />
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
    <View style={styles.container}>
      <Text style={styles.title}>Carte de matching</Text>
      <DetourFilter value={selectedDetour} onChange={handleDetourChange} />

      <View style={styles.mapWrap}>
        <CrossPlatformMap pins={mapPins} paths={mapPaths} height={mapHeight} />
      </View>

      <View style={styles.overlayPanel}>
        <Text style={styles.overlayTitle}>{filteredMatches.length} colis compatibles</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.overlayList}>
          {filteredMatches.slice(0, 8).map((item) => (
            <View key={item._id} style={styles.card}>
              <Text style={styles.cardTitle}>Score {item.score}</Text>
              <Text style={styles.cardLine}>{item.detourMinutes} min</Text>
              <Text style={styles.price}>{item.pricingEstimate.totalAmount} EUR</Text>
            </View>
          ))}
          {filteredMatches.length === 0 ? (
            <Text style={styles.emptyText}>Aucun colis compatible pour ce seuil.</Text>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 16,
    paddingTop: 60,
  },
  title: {
    fontSize: 22,
    color: "#0F172A",
    fontWeight: "700",
    marginBottom: 12,
  },
  mapWrap: {
    marginTop: 12,
    marginBottom: 8,
  },
  overlayPanel: {
    marginTop: 2,
  },
  overlayTitle: {
    color: "#0F172A",
    fontWeight: "700",
    marginBottom: 6,
  },
  overlayList: {
    gap: 8,
    paddingBottom: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minWidth: 140,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6,
  },
  cardLine: {
    fontSize: 13,
    color: "#475569",
  },
  price: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: "700",
    color: "#4338CA",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F8FAFC",
  },
  emptyTitle: {
    fontSize: 18,
    color: "#0F172A",
    fontWeight: "700",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
  },
});
