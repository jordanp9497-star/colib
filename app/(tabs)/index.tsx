import { useMemo, useState } from "react";
import {
  Alert,
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "@/convex/_generated/api";
import TripCard from "@/components/TripCard";
import { AddressAutocompleteInput } from "@/components/maps/AddressAutocompleteInput";
import { buildDayWindowTimestamps } from "@/components/forms/TimeWindowInput";
import type { GeocodedAddress } from "@/packages/shared/maps";

const SEARCH_RADIUS_KM = 30;

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
  const trips = useQuery(api.trips.list) as TripListItem[] | undefined;
  const [originZone, setOriginZone] = useState<GeocodedAddress | null>(null);
  const [destinationZone, setDestinationZone] = useState<GeocodedAddress | null>(null);
  const [dateValue, setDateValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<TripListItem[]>([]);

  const publishedTrips = useMemo(
    () => (trips ?? []).filter((trip) => trip.status === "published"),
    [trips]
  );

  const handleSearch = () => {
    if (!destinationZone) {
      Alert.alert("Destination requise", "Selectionnez une zone d'arrivee pour lancer la recherche.");
      return;
    }

    const dayWindow = dateValue.trim()
      ? buildDayWindowTimestamps(dateValue.trim())
      : null;

    if (dateValue.trim() && !dayWindow) {
      Alert.alert("Date invalide", "Utilisez le format JJ/MM/AAAA ou laissez vide.");
      return;
    }

    const filtered = publishedTrips.filter((trip) => {
      const arrivalDistance = haversineKm(
        { lat: trip.destinationAddress.lat, lng: trip.destinationAddress.lng },
        { lat: destinationZone.lat, lng: destinationZone.lng }
      );
      if (arrivalDistance > SEARCH_RADIUS_KM) {
        return false;
      }

      if (originZone) {
        const departureDistance = haversineKm(
          { lat: trip.originAddress.lat, lng: trip.originAddress.lng },
          { lat: originZone.lat, lng: originZone.lng }
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
  };

  const listData = submitted ? results : [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Colib</Text>
        <Text style={styles.subtitle}>
          Recherchez un trajet par zones et date
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <AddressAutocompleteInput
          label="Zone depart (optionnelle, rayon 30 km)"
          placeholder="Ville ou adresse de depart"
          value={originZone}
          onChange={setOriginZone}
        />
        <AddressAutocompleteInput
          label="Zone arrivee (obligatoire, rayon 30 km)"
          placeholder="Ville ou adresse d'arrivee"
          value={destinationZone}
          onChange={setDestinationZone}
        />
        <Text style={styles.inputLabel}>Date (optionnelle)</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="JJ/MM/AAAA"
          placeholderTextColor="#94A3B8"
          value={dateValue}
          onChangeText={setDateValue}
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Rechercher des trajets</Text>
        </TouchableOpacity>
      </View>

      {trips === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : listData.length > 0 ? (
        <FlatList
          data={listData}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.85} onPress={() => router.push(`/trip/${item._id}` as any)}>
              <TripCard trip={item} />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🚗</Text>
          <Text style={styles.emptyTitle}>{submitted ? "Aucun trajet trouve" : "Lancez une recherche"}</Text>
          <Text style={styles.emptyText}>
            {submitted
              ? "Essayez d'elargir la zone de depart ou retirez le filtre date."
              : "La zone d'arrivee est obligatoire, la date reste optionnelle."}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 8,
    backgroundColor: "#6366F1",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 14,
    color: "#C7D2FE",
    marginTop: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#F8FAFC",
    paddingBottom: 20,
    gap: 10,
  },
  inputLabel: {
    marginTop: -2,
    marginBottom: -4,
    color: "#334155",
    fontWeight: "600",
    fontSize: 13,
  },
  searchInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1E293B",
  },
  searchButton: {
    marginTop: 2,
    backgroundColor: "#0F172A",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  list: {
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
});
