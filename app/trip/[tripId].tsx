import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatShortAddress } from "@/utils/address";

export default function TripDetailsScreen() {
  const params = useLocalSearchParams<{ tripId?: string }>();
  const tripId = typeof params.tripId === "string" ? params.tripId : undefined;

  const trip = useQuery(api.trips.getById, tripId ? { tripId: tripId as any } : "skip");

  if (trip === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4338CA" />
      </View>
    );
  }

  if (!trip || trip.status !== "published") {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Annonce trajet introuvable</Text>
      </View>
    );
  }

  const origin = formatShortAddress(trip.originAddress, trip.origin);
  const destination = formatShortAddress(trip.destinationAddress, trip.destination);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Annonce trajet</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Itineraire</Text>
        <View style={styles.row}>
          <Ionicons name="pin" size={16} color="#2563EB" />
          <Text style={styles.label}>Depart</Text>
        </View>
        <Text style={styles.value}>{origin}</Text>

        <View style={styles.rowSpaced}>
          <View style={styles.row}>
            <Ionicons name="flag" size={16} color="#16A34A" />
            <Text style={styles.label}>Arrivee</Text>
          </View>
        </View>
        <Text style={styles.value}>{destination}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Informations</Text>
        <Text style={styles.metaLine}>Date: {trip.date}</Text>
        <Text style={styles.metaLine}>Espace: {trip.availableSpace}</Text>
        <Text style={styles.metaLine}>Poids max: {trip.maxWeightKg} kg</Text>
        <Text style={styles.metaLine}>Volume max: {trip.maxVolumeDm3} dm3</Text>
        <Text style={styles.metaLine}>Prix de base: {trip.price} EUR</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Publie par</Text>
        <View style={styles.row}>
          <Ionicons name="person-circle-outline" size={18} color="#475569" />
          <Text style={styles.publisher}>{trip.userName}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 16,
    paddingTop: 56,
    paddingBottom: 28,
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowSpaced: {
    marginTop: 10,
  },
  label: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  value: {
    marginTop: 4,
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "600",
  },
  metaLine: {
    fontSize: 14,
    color: "#334155",
    marginBottom: 4,
  },
  publisher: {
    fontSize: 15,
    color: "#1E293B",
    fontWeight: "600",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
});
