import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/context/UserContext";
import { formatShortAddress } from "@/utils/address";
import { Colors, Fonts } from "@/constants/theme";

export default function ParcelDetailsScreen() {
  const params = useLocalSearchParams<{ parcelId?: string }>();
  const parcelId = typeof params.parcelId === "string" ? params.parcelId : undefined;
  const { userId } = useUser();

  const parcel = useQuery(api.parcels.getById, parcelId ? { parcelId: parcelId as any } : "skip");
  const matches = useQuery(api.matches.listByParcel, parcelId ? { parcelId: parcelId as any } : "skip");
  const myTrips = useQuery(api.trips.getByUser, { userId });
  const reserveMatch = useMutation((api as any).matches.reserveFromTripOwner);
  const removeParcel = useMutation(api.parcels.remove);

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
  const isOwner = parcel.ownerVisitorId === userId;

  const handleDeleteParcel = () => {
    Alert.alert("Supprimer l'annonce", "Voulez-vous vraiment supprimer ce colis ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await removeParcel({ parcelId: parcel._id, ownerVisitorId: userId });
            Alert.alert("Annonce supprimee", "Votre colis a ete retire.");
            router.replace("/(tabs)/profile" as any);
          } catch {
            Alert.alert("Erreur", "Impossible de supprimer ce colis.");
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
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as any))}
      >
        <Ionicons name="arrow-back" size={16} color={Colors.dark.textSecondary} />
        <Text style={styles.backButtonText}>Retour</Text>
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
          <Ionicons name="person-circle-outline" size={18} color={Colors.dark.textSecondary} />
          <Text style={styles.publisher}>{parcel.userName}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{parcel.description || "Aucune description fournie."}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Taille: {parcel.size}</Text>
          <Text style={styles.metaText}>Poids: {parcel.weight} kg</Text>
          {parcel.proposedPrice ? <Text style={styles.metaText}>Prix propose: {parcel.proposedPrice} EUR</Text> : null}
        </View>
        {parcel.parcelPhotoUrl ? <Image source={{ uri: parcel.parcelPhotoUrl }} style={styles.parcelPhoto} /> : null}
      </View>

      {isOwner ? (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push({ pathname: "/(tabs)/send", params: { parcelId: String(parcel._id) } })}
          >
            <Text style={styles.editButtonText}>Modifier l&apos;annonce</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteParcel}>
            <Text style={styles.deleteButtonText}>Supprimer l&apos;annonce</Text>
          </TouchableOpacity>
        </View>
      ) : (
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
      )}
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
    marginBottom: 4,
    backgroundColor: "#161D24",
  },
  backButtonText: { fontSize: 12, color: Colors.dark.textSecondary, fontFamily: Fonts.sansSemiBold },
  title: {
    fontSize: 24,
    color: Colors.dark.text,
    marginBottom: 6,
    fontFamily: Fonts.displaySemiBold,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
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
  publisher: {
    fontSize: 15,
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
  },
  description: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
    fontFamily: Fonts.sans,
  },
  metaRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  metaText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sansSemiBold,
  },
  parcelPhoto: {
    marginTop: 10,
    width: "100%",
    height: 190,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surfaceMuted,
  },
  hint: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 10,
    fontFamily: Fonts.sans,
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
    color: Colors.dark.text,
    fontSize: 15,
    fontFamily: Fonts.sansSemiBold,
  },
  actionsRow: {
    marginTop: 2,
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
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  deleteButton: {
    borderRadius: 10,
    backgroundColor: "#B91C1C",
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F141A",
  },
  emptyTitle: {
    fontSize: 18,
    color: Colors.dark.text,
    fontFamily: Fonts.displaySemiBold,
  },
});
