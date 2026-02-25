import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/context/UserContext";
import { SwipeActionRow } from "@/components/gestures/SwipeActionRow";
import { Colors, Fonts } from "@/constants/theme";

function formatRelativeDate(timestamp: number) {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Date(timestamp).toLocaleDateString("fr-FR");
}

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

  const list = notifications ?? [];
  const pendingNotifications = list.filter((notification) => {
    const canAcceptReservation =
      notification.type === "reservation_request" &&
      notification.matchId &&
      notification.matchStatus === "requested";
    return !notification.readAt || canAcceptReservation;
  });
  const historyNotifications = list.filter((notification) => !pendingNotifications.includes(notification));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      scrollEventThrottle={16}
    >
      {router.canGoBack() ? (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as any))}
        >
          <Ionicons name="arrow-back" size={16} color={Colors.dark.textSecondary} />
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.title}>Activite</Text>
      <Text style={styles.subtitle}>Actions en attente et suivi en cours.</Text>

      {!notifications ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={Colors.dark.primary} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="notifications-off-outline" size={18} color={Colors.dark.textSecondary} />
          <Text style={styles.emptyTitle}>Aucune action a traiter</Text>
          <Text style={styles.emptyText}>Vous recevrez ici les demandes de reservation et les updates de suivi.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>A traiter ({pendingNotifications.length})</Text>
          {pendingNotifications.length === 0 ? (
            <Text style={styles.sectionEmptyText}>Aucune action urgente en attente.</Text>
          ) : (
            pendingNotifications.map((notification) => {
              const canAcceptReservation =
                notification.type === "reservation_request" &&
                notification.matchId &&
                notification.matchStatus === "requested";
              const linkedShipment =
                notification.matchId && shipments
                  ? shipments.find((shipment) => String(shipment.matchId) === String(notification.matchId))
                  : null;
              const needsPayment = notification.type === "payment_required" && Boolean(linkedShipment);

              return (
                <SwipeActionRow
                  key={notification._id}
                  actions={[
                    ...(canAcceptReservation
                      ? [
                          {
                            label: "Accepter",
                            color: Colors.dark.success,
                            onPress: () => void handleAcceptReservation(String(notification.matchId)),
                          },
                        ]
                      : []),
                    ...(!notification.readAt
                      ? [
                          {
                            label: "Marquer lu",
                            color: Colors.dark.primary,
                            onPress: () => void handleMarkRead(String(notification._id)),
                          },
                        ]
                      : []),
                    ...(linkedShipment
                      ? [
                          {
                            label: "Voir suivi",
                            color: Colors.dark.warning,
                            textColor: "#1E293B",
                            onPress: () =>
                              router.push({ pathname: "/shipment/[shipmentId]", params: { shipmentId: String(linkedShipment._id) } }),
                          },
                        ]
                      : []),
                    ...(needsPayment
                      ? [
                          {
                            label: "Payer",
                            color: Colors.dark.success,
                            onPress: () =>
                              router.push({ pathname: "/shipment/[shipmentId]", params: { shipmentId: String(linkedShipment?._id) } }),
                          },
                        ]
                      : []),
                  ]}
                >
                  <View style={[styles.card, !notification.readAt && styles.cardUnread]}>
                    <View style={styles.cardMetaRow}>
                      <Text style={styles.cardTitle}>{notification.title}</Text>
                      {!notification.readAt ? <Text style={styles.unreadBadge}>Non lu</Text> : null}
                    </View>
                    <Text style={styles.cardText}>{notification.message}</Text>
                    <Text style={styles.relativeDate}>{formatRelativeDate(notification.createdAt)}</Text>

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

                      {needsPayment ? (
                        <TouchableOpacity
                          style={styles.acceptButton}
                          onPress={() => router.push({ pathname: "/shipment/[shipmentId]", params: { shipmentId: String(linkedShipment?._id) } })}
                        >
                          <Text style={styles.acceptButtonText}>Payer maintenant</Text>
                        </TouchableOpacity>
                      ) : null}

                      {!notification.readAt ? (
                        <TouchableOpacity style={styles.readButton} onPress={() => void handleMarkRead(String(notification._id))}>
                          <Text style={styles.readButtonText}>Marquer lu</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                </SwipeActionRow>
              );
            })
          )}

          <Text style={styles.sectionTitle}>Historique ({historyNotifications.length})</Text>
          {historyNotifications.length === 0 ? (
            <Text style={styles.sectionEmptyText}>Aucune notification archivee.</Text>
          ) : (
            historyNotifications.map((notification) => {
              const linkedShipment =
                notification.matchId && shipments
                  ? shipments.find((shipment) => String(shipment.matchId) === String(notification.matchId))
                  : null;

              return (
                <View key={notification._id} style={styles.card}>
                  <View style={styles.cardMetaRow}>
                    <Text style={styles.cardTitle}>{notification.title}</Text>
                    <Text style={styles.relativeDate}>{formatRelativeDate(notification.createdAt)}</Text>
                  </View>
                  <Text style={styles.cardText}>{notification.message}</Text>
                  {linkedShipment ? (
                    <TouchableOpacity
                      style={[styles.trackButton, styles.historyTrackButton]}
                      onPress={() => router.push({ pathname: "/shipment/[shipmentId]", params: { shipmentId: String(linkedShipment._id) } })}
                    >
                      <Text style={styles.trackButtonText}>Ouvrir suivi</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })
          )}
        </>
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
  sectionTitle: {
    marginTop: 8,
    marginBottom: 2,
    fontSize: 15,
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
  },
  sectionEmptyText: {
    marginBottom: 6,
    color: Colors.dark.textSecondary,
    fontSize: 13,
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
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  unreadBadge: {
    borderRadius: 999,
    backgroundColor: Colors.dark.primary,
    color: Colors.dark.text,
    paddingVertical: 3,
    paddingHorizontal: 8,
    fontSize: 11,
    fontFamily: Fonts.sansSemiBold,
  },
  cardTitle: {
    fontSize: 14,
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
    flex: 1,
  },
  cardText: {
    marginTop: 4,
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  relativeDate: {
    marginTop: 6,
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sans,
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
  historyTrackButton: {
    marginTop: 10,
    alignSelf: "flex-start",
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
