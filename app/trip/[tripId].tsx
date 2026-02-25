import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/context/UserContext";
import { formatShortAddress } from "@/utils/address";

export default function TripDetailsScreen() {
  const params = useLocalSearchParams<{ tripId?: string }>();
  const tripId = typeof params.tripId === "string" ? params.tripId : undefined;
  const { userId } = useUser();

  const trip = useQuery(api.trips.getById, tripId ? { tripId: tripId as any } : "skip");
  const removeTrip = useMutation(api.trips.remove);

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
  const isOwner = trip.ownerVisitorId === userId;

  const handleDeleteTrip = () => {
    Alert.alert("Supprimer l'annonce", "Voulez-vous vraiment supprimer ce trajet ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await removeTrip({ tripId: trip._id, ownerVisitorId: userId });
            Alert.alert("Annonce supprimee", "Votre trajet a ete retire.");
            router.replace("/(tabs)/profile" as any);
          } catch {
            Alert.alert("Erreur", "Impossible de supprimer ce trajet.");
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      scrollEventThrottle={16}
    >
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/map" as any))}
      >
        <Ionicons name="arrow-back" size={16} color="#CBD5E1" />
        <Text style={styles.backButtonText}>Retour carte</Text>
      </TouchableOpacity>

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

      {isOwner ? (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push({ pathname: "/(tabs)/offer", params: { tripId: String(trip._id) } })}
          >
            <Text style={styles.editButtonText}>Modifier l&apos;annonce</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteTrip}>
            <Text style={styles.deleteButtonText}>Supprimer l&apos;annonce</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F141A",
  },
  content: {
    padding: 16,
    paddingTop: 56,
    paddingBottom: 28,
    gap: 10,
  },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 4,
    backgroundColor: "#161D24",
  },
  backButtonText: { fontSize: 12, fontWeight: "700", color: "#CBD5E1" },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#E2E8F0",
    marginBottom: 6,
  },
  card: {
    backgroundColor: "#161D24",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F8FAFC",
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
    color: "#E2E8F0",
    fontWeight: "600",
  },
  metaLine: {
    fontSize: 14,
    color: "#CBD5E1",
    marginBottom: 4,
  },
  publisher: {
    fontSize: 15,
    color: "#E2E8F0",
    fontWeight: "600",
  },
  actionsRow: {
    marginTop: 4,
    gap: 10,
  },
  editButton: {
    borderRadius: 10,
    backgroundColor: "#2563EB",
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  deleteButton: {
    borderRadius: 10,
    backgroundColor: "#B91C1C",
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F141A",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#E2E8F0",
  },
});
