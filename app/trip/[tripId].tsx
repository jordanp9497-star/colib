import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ActionButton } from "@/components/ui/action-button";
import { useUser } from "@/context/UserContext";
import { BackButton } from "@/components/ui/back-button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatShortAddress } from "@/utils/address";
import { Colors, Fonts } from "@/constants/theme";

export default function TripDetailsScreen() {
  const params = useLocalSearchParams<{ tripId?: string }>();
  const tripId = typeof params.tripId === "string" ? params.tripId : undefined;
  const { userId } = useUser();

  const trip = useQuery(api.trips.getById, tripId ? { tripId: tripId as any } : "skip");
  const removeTrip = useMutation(api.trips.remove);

  if (trip === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
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
      <BackButton label="Retour carte" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/map" as any))} />

      <Text style={styles.title}>Annonce trajet</Text>

      <SurfaceCard style={styles.card}>
        <Text style={styles.sectionTitle}>Itineraire</Text>
        <View style={styles.row}>
          <Ionicons name="pin" size={16} color={Colors.dark.primary} />
          <Text style={styles.label}>Depart</Text>
        </View>
        <Text style={styles.value}>{origin}</Text>

        <View style={styles.rowSpaced}>
          <View style={styles.row}>
            <Ionicons name="flag" size={16} color={Colors.dark.success} />
            <Text style={styles.label}>Arrivee</Text>
          </View>
        </View>
        <Text style={styles.value}>{destination}</Text>
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <Text style={styles.sectionTitle}>Informations</Text>
        <Text style={styles.metaLine}>Date: {trip.date}</Text>
        <Text style={styles.metaLine}>Espace: {trip.availableSpace}</Text>
        <Text style={styles.metaLine}>Poids max: {trip.maxWeightKg} kg</Text>
        <Text style={styles.metaLine}>Volume max: {trip.maxVolumeDm3} dm3</Text>
        <Text style={styles.metaLine}>Prix de base: {trip.price} EUR</Text>
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <Text style={styles.sectionTitle}>Publie par</Text>
        <View style={styles.row}>
          <Ionicons name="person-circle-outline" size={18} color={Colors.dark.textSecondary} />
          <Text style={styles.publisher}>{trip.userName}</Text>
        </View>
      </SurfaceCard>

      {isOwner ? (
        <View style={styles.actionsRow}>
          <ActionButton
            label="Modifier l'annonce"
            size="sm"
            style={styles.editButton}
            onPress={() => router.push({ pathname: "/(tabs)/offer", params: { tripId: String(trip._id) } })}
          />
          <ActionButton label="Supprimer l'annonce" variant="danger" size="sm" style={styles.deleteButton} onPress={handleDeleteTrip} />
        </View>
      ) : null}
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
    paddingTop: 56,
    paddingBottom: 28,
    gap: 10,
  },
  title: {
    fontSize: 24,
    color: Colors.dark.text,
    marginBottom: 6,
    fontFamily: Fonts.displaySemiBold,
  },
  card: {
    padding: 14,
  },
  sectionTitle: {
    fontSize: 15,
    color: Colors.dark.text,
    marginBottom: 8,
    fontFamily: Fonts.sansSemiBold,
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
    color: Colors.dark.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  value: {
    marginTop: 4,
    fontSize: 14,
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
  },
  metaLine: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
    fontFamily: Fonts.sans,
  },
  publisher: {
    fontSize: 15,
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
  },
  actionsRow: {
    marginTop: 4,
    gap: 10,
  },
  editButton: {
    minHeight: 42,
  },
  deleteButton: {
    minHeight: 42,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.background,
  },
  emptyTitle: {
    fontSize: 18,
    color: Colors.dark.text,
    fontFamily: Fonts.displaySemiBold,
  },
});
