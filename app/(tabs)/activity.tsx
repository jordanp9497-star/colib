import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/context/UserContext";
import { Colors, Fonts } from "@/constants/theme";

export default function ActivityScreen() {
  const { userId } = useUser();
  const notifications = useQuery(api.notifications.listForUser, { userId });
  const shipments = useQuery(api.shipments.listForUser, { requesterVisitorId: userId, limit: 100 });
  const acceptReservationRequest = useMutation(api.matches.acceptReservationRequest);
  const markNotificationAsRead = useMutation(api.notifications.markAsRead);

  const handleAcceptReservation = async (matchId: string) => {
    try {
      await acceptReservationRequest({
        matchId: matchId as any,
        parcelOwnerVisitorId: userId,
      });
    } catch {
      Alert.alert("Erreur", "Impossible d'accepter la demande pour le moment.");
    }
  };

  const handleMarkRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead({ notificationId: notificationId as any, userId });
    } catch {
      Alert.alert("Erreur", "Impossible de marquer la notification comme lue.");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {router.canGoBack() ? (
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={16} color={Colors.dark.textSecondary} />
          <Text style={styles.backButtonText}>Precedent</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.title}>Activite</Text>
      <Text style={styles.subtitle}>Actions en attente et suivi en cours.</Text>

      {!notifications ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={Colors.dark.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="notifications-off-outline" size={18} color={Colors.dark.textSecondary} />
          <Text style={styles.emptyTitle}>Aucune action a traiter</Text>
          <Text style={styles.emptyText}>Vous recevrez ici les demandes de reservation et les updates de suivi.</Text>
        </View>
      ) : (
        notifications.map((notification) => {
          const canAcceptReservation =
            notification.type === "reservation_request" &&
            notification.matchId &&
            notification.matchStatus === "requested";
          const linkedShipment =
            notification.matchId && shipments
              ? shipments.find((shipment) => String(shipment.matchId) === String(notification.matchId))
              : null;

          return (
            <View
              key={notification._id}
              style={[styles.card, !notification.readAt && styles.cardUnread]}
            >
              <Text style={styles.cardTitle}>{notification.title}</Text>
              <Text style={styles.cardText}>{notification.message}</Text>

              <View style={styles.actionsRow}>
                {canAcceptReservation ? (
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => void handleAcceptReservation(String(notification.matchId))}
                  >
                    <Text style={styles.acceptButtonText}>Accepter</Text>
                  </TouchableOpacity>
                ) : null}

                {linkedShipment ? (
                  <TouchableOpacity
                    style={styles.trackButton}
                    onPress={() => router.push({ pathname: "/shipment/[shipmentId]", params: { shipmentId: String(linkedShipment._id) } })}
                  >
                    <Text style={styles.trackButtonText}>Voir suivi</Text>
                  </TouchableOpacity>
                ) : null}

                {!notification.readAt ? (
                  <TouchableOpacity style={styles.readButton} onPress={() => void handleMarkRead(String(notification._id))}>
                    <Text style={styles.readButtonText}>Marquer lu</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })
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
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 24,
    gap: 10,
  },
  title: {
    fontSize: 24,
    color: Colors.dark.text,
    fontFamily: Fonts.displaySemiBold,
  },
  subtitle: {
    marginBottom: 6,
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sans,
  },
  center: {
    marginTop: 24,
    alignItems: "center",
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
    marginBottom: 2,
    backgroundColor: Colors.dark.surface,
  },
  backButtonText: { fontSize: 12, color: Colors.dark.textSecondary, fontFamily: Fonts.sansSemiBold },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    padding: 12,
  },
  cardUnread: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primaryLight,
  },
  cardTitle: {
    fontSize: 14,
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
  },
  cardText: {
    marginTop: 4,
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  actionsRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  acceptButton: {
    borderRadius: 8,
    backgroundColor: Colors.dark.success,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  acceptButtonText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: "700",
  },
  trackButton: {
    borderRadius: 8,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  trackButtonText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: "700",
  },
  readButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  readButtonText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    padding: 14,
    alignItems: "flex-start",
    gap: 6,
  },
  emptyTitle: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "700",
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
