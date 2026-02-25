import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/context/UserContext";
import { formatShortAddress } from "@/utils/address";

export default function ParcelDetailsScreen() {
  const params = useLocalSearchParams<{ parcelId?: string }>();
  const parcelId = typeof params.parcelId === "string" ? params.parcelId : undefined;
  const { userId } = useUser();

  const parcel = useQuery(api.parcels.getById, parcelId ? { parcelId: parcelId as any } : "skip");
  const matches = useQuery(api.matches.listByParcel, parcelId ? { parcelId: parcelId as any } : "skip");
  const myTrips = useQuery(api.trips.getByUser, { userId });
  const reserveMatch = useMutation((api as any).matches.reserveFromTripOwner);

  const [isReserving, setIsReserving] = useState(false);

  const activeTrip = useMemo(() => myTrips?.find((trip) => trip.status === "published"), [myTrips]);
  const matchForActiveTrip = useMemo(() => {
    if (!activeTrip || !matches) return null;
    return matches.find((match) => String(match.tripId) === String(activeTrip._id)) ?? null;
  }, [activeTrip, matches]);

  if (parcel === undefined || matches === undefined || myTrips === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4338CA" />
      </View>
    );
  }

  if (!parcel) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Annonce introuvable</Text>
      </View>
    );
  }

  const handleReserve = async () => {
    if (!matchForActiveTrip) {
      Alert.alert("Reservation impossible", "Ce colis n'est pas associe a votre trajet actif.");
      return;
    }
    setIsReserving(true);
    try {
      await reserveMatch({
        matchId: matchForActiveTrip._id,
        tripOwnerVisitorId: userId,
      });
      Alert.alert("Demande envoyee", "Le publicateur du colis a recu votre demande de reservation.");
    } catch {
      Alert.alert("Erreur", "Impossible de reserver ce colis pour le moment.");
    } finally {
      setIsReserving(false);
    }
  };

  const canReserve = Boolean(matchForActiveTrip);
  const shortOrigin = formatShortAddress(parcel.originAddress, parcel.origin);
  const shortDestination = formatShortAddress(parcel.destinationAddress, parcel.destination);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={16} color="#334155" />
        <Text style={styles.backButtonText}>Precedent</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Annonce colis</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Itineraire du colis</Text>
        <View style={styles.row}>
          <Ionicons name="pin" size={16} color="#2563EB" />
          <Text style={styles.label}>Recuperation</Text>
        </View>
        <Text style={styles.value}>{shortOrigin}</Text>

        <View style={styles.rowSpaced}>
          <View style={styles.row}>
            <Ionicons name="flag" size={16} color="#16A34A" />
            <Text style={styles.label}>Livraison</Text>
          </View>
        </View>
        <Text style={styles.value}>{shortDestination}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Publie par</Text>
        <View style={styles.row}>
          <Ionicons name="person-circle-outline" size={18} color="#475569" />
          <Text style={styles.publisher}>{parcel.userName}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{parcel.description || "Aucune description fournie."}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Taille: {parcel.size}</Text>
          <Text style={styles.metaText}>Poids: {parcel.weight} kg</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Reserver</Text>
        {!activeTrip ? (
          <Text style={styles.hint}>Publiez un trajet pour pouvoir reserver ce colis.</Text>
        ) : !canReserve ? (
          <Text style={styles.hint}>Ce colis n est pas encore match avec votre trajet actif.</Text>
        ) : (
          <Text style={styles.hint}>Ce colis est compatible avec votre trajet actif.</Text>
        )}

        <TouchableOpacity
          style={[styles.reserveButton, (!canReserve || isReserving) && styles.reserveButtonDisabled]}
          onPress={handleReserve}
          disabled={!canReserve || isReserving}
        >
          {isReserving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.reserveButtonText}>Reserver</Text>}
        </TouchableOpacity>
      </View>
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
  backButtonText: { fontSize: 12, fontWeight: "700", color: "#334155" },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
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
  publisher: {
    fontSize: 15,
    color: "#1E293B",
    fontWeight: "600",
  },
  description: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 20,
  },
  metaRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  metaText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
  },
  hint: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 10,
  },
  reserveButton: {
    backgroundColor: "#EA580C",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  reserveButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  reserveButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
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
    color: "#0F172A",
  },
});
