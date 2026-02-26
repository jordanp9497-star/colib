import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
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

export default function ParcelDetailsScreen() {
  const params = useLocalSearchParams<{ parcelId?: string }>();
  const parcelId = typeof params.parcelId === "string" ? params.parcelId : undefined;
  const { userId } = useUser();

  const parcel = useQuery(api.parcels.getById, parcelId ? { parcelId: parcelId as any } : "skip");
  const matches = useQuery(api.matches.listByParcel, parcelId ? { parcelId: parcelId as any } : "skip");
  const myTrips = useQuery(api.trips.getByUser, { userId });
  const myNotifications = useQuery(api.notifications.listForUser, { userId });
  const reserveMatch = useMutation((api as any).matches.reserveFromTripOwner);
  const removeParcel = useMutation(api.parcels.remove);

  const [isReserving, setIsReserving] = useState(false);

  const activeTrip = useMemo(() => myTrips?.find((trip) => trip.status === "published"), [myTrips]);
  const matchForActiveTrip = useMemo(() => {
    if (!activeTrip || !matches) return null;
    return matches.find((match) => String(match.tripId) === String(activeTrip._id)) ?? null;
  }, [activeTrip, matches]);

  const visibilityTip = useMemo(() => {
    if (!parcel || !myNotifications) return null;
    if (parcel.ownerVisitorId !== userId) return null;
    return (
      myNotifications.find(
        (notification) =>
          notification.type === "parcel_visibility_tip" &&
          String(notification.parcelId) === String(parcel._id)
      ) ?? null
    );
  }, [myNotifications, parcel, userId]);

  if (parcel === undefined || matches === undefined || myTrips === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
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

  const canReserve = Boolean(matchForActiveTrip);
  const shortOrigin = formatShortAddress(parcel.originAddress, parcel.origin);
  const shortDestination = formatShortAddress(parcel.destinationAddress, parcel.destination);
  const isOwner = parcel.ownerVisitorId === userId;
  const reserveHint = !activeTrip
    ? isOwner
      ? "Publiez un trajet pour tester la reservation de bout en bout."
      : "Publiez un trajet pour pouvoir reserver ce colis."
    : !canReserve
      ? "Ce colis n est pas encore match avec votre trajet actif."
      : isOwner
        ? "Mode test solo: vous pouvez reserver votre propre colis pour valider le flow complet."
        : "Ce colis est compatible avec votre trajet actif.";

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
      Alert.alert(
        "Demande envoyee",
        isOwner
          ? "Mode test solo: ouvrez Activite pour accepter la demande puis poursuivre le suivi."
          : "Le publicateur du colis a recu votre demande de reservation."
      );
    } catch {
      Alert.alert("Erreur", "Impossible de reserver ce colis pour le moment.");
    } finally {
      setIsReserving(false);
    }
  };

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
      <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as any))} />

      <Text style={styles.title}>Annonce colis</Text>

      {visibilityTip ? (
        <SurfaceCard style={styles.tipCard}>
          <View style={styles.row}>
            <Ionicons name="flash-outline" size={16} color={Colors.dark.warning} />
            <Text style={styles.tipTitle}>Visibilite faible</Text>
          </View>
          <Text style={styles.tipText}>{visibilityTip.message}</Text>
        </SurfaceCard>
      ) : null}

      <SurfaceCard style={styles.card}>
        <Text style={styles.sectionTitle}>Itineraire du colis</Text>
        <View style={styles.row}>
          <Ionicons name="pin" size={16} color={Colors.dark.primary} />
          <Text style={styles.label}>Recuperation</Text>
        </View>
        <Text style={styles.value}>{shortOrigin}</Text>

        <View style={styles.rowSpaced}>
          <View style={styles.row}>
            <Ionicons name="flag" size={16} color={Colors.dark.success} />
            <Text style={styles.label}>Livraison</Text>
          </View>
        </View>
        <Text style={styles.value}>{shortDestination}</Text>
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <Text style={styles.sectionTitle}>Publie par</Text>
        <View style={styles.row}>
          <Ionicons name="person-circle-outline" size={18} color={Colors.dark.textSecondary} />
          <Text style={styles.publisher}>{parcel.userName}</Text>
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{parcel.description || "Aucune description fournie."}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Taille: {parcel.size}</Text>
          <Text style={styles.metaText}>Poids: {parcel.weight} kg</Text>
          {parcel.proposedPrice ? <Text style={styles.metaText}>Prix propose: {parcel.proposedPrice} EUR</Text> : null}
        </View>
        {parcel.parcelPhotoUrl ? <Image source={{ uri: parcel.parcelPhotoUrl }} style={styles.parcelPhoto} /> : null}
      </SurfaceCard>

      {isOwner ? (
        <View style={styles.actionsRow}>
          <ActionButton
            label="Modifier l'annonce"
            size="sm"
            style={styles.editButton}
            onPress={() => router.push({ pathname: "/(tabs)/send", params: { parcelId: String(parcel._id) } })}
          />
          <ActionButton label="Supprimer l'annonce" variant="danger" size="sm" style={styles.deleteButton} onPress={handleDeleteParcel} />
        </View>
      ) : null}

      <SurfaceCard style={styles.card}>
        <Text style={styles.sectionTitle}>Reserver</Text>
        <Text style={styles.hint}>{reserveHint}</Text>

        {isOwner ? (
          <View style={styles.soloFlowCard}>
            <Text style={styles.soloFlowTitle}>Test solo - flow complet</Text>
            <Text style={styles.soloFlowStep}>1. Reserver ce colis depuis votre trajet actif</Text>
            <Text style={styles.soloFlowStep}>2. Ouvrir Activite et accepter la demande</Text>
            <Text style={styles.soloFlowStep}>3. Ouvrir le suivi, confirmer le paiement puis avancer les statuts</Text>
            <Text style={styles.soloFlowStep}>4. Finaliser la livraison et scanner le QR code</Text>
          </View>
        ) : null}

        <ActionButton
          label={isOwner ? "Reserver (test solo)" : "Reserver"}
          variant="info"
          size="sm"
          loading={isReserving}
          style={[styles.reserveButton, (!canReserve || isReserving) && styles.reserveButtonDisabled]}
          onPress={handleReserve}
          disabled={!canReserve || isReserving}
        />
      </SurfaceCard>
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
    minHeight: 42,
  },
  reserveButtonDisabled: {
    opacity: 0.5,
  },
  soloFlowCard: {
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 4,
  },
  soloFlowTitle: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  soloFlowStep: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Fonts.sans,
  },
  actionsRow: {
    marginTop: 2,
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
  tipCard: {
    padding: 12,
    backgroundColor: Colors.dark.surfaceMuted,
  },
  tipTitle: {
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  tipText: {
    marginTop: 6,
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.sans,
  },
});
