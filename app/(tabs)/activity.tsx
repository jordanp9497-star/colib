import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/context/UserContext";
import { SwipeActionRow } from "@/components/gestures/SwipeActionRow";
import { ActionButton } from "@/components/ui/action-button";
import { BackButton } from "@/components/ui/back-button";
import { SurfaceCard } from "@/components/ui/surface-card";
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
  const { userId, isLoggedIn } = useUser();
  const notifications = useQuery(api.notifications.listForUser, isLoggedIn ? { userId } : "skip");
  const shipments = useQuery(api.shipments.listForUser, isLoggedIn ? { requesterVisitorId: userId, limit: 100 } : "skip");
  const acceptReservationRequest = useMutation(api.matches.acceptReservationRequest);
  const markNotificationAsRead = useMutation(api.notifications.markAsRead);

  if (!isLoggedIn) {
    return (
      <View style={styles.blockedWrap}>
        <Ionicons name="lock-closed-outline" size={22} color={Colors.dark.textSecondary} />
        <Text style={styles.title}>Connectez-vous pour voir votre activite</Text>
        <Text style={styles.subtitle}>Les notifications, demandes et suivis apparaissent apres connexion.</Text>
      </View>
    );
  }

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
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as any))} />
      ) : null}

      <Text style={styles.title}>Activite</Text>
      <Text style={styles.subtitle}>Actions en attente et suivi en cours.</Text>

      {!notifications ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={Colors.dark.primary} />
        </View>
      ) : list.length === 0 ? (
        <SurfaceCard style={styles.emptyCard}>
          <Ionicons name="notifications-off-outline" size={18} color={Colors.dark.textSecondary} />
          <Text style={styles.emptyTitle}>Aucune action a traiter</Text>
          <Text style={styles.emptyText}>Vous recevrez ici les demandes de reservation et les updates de suivi.</Text>
        </SurfaceCard>
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
              const canOpenChat =
                notification.type === "reservation_request" &&
                notification.matchStatus === "requested" &&
                Boolean(linkedShipment);
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
                            label: canOpenChat ? "Messagerie" : "Voir suivi",
                            color: Colors.dark.warning,
                            textColor: Colors.dark.background,
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
                  <SurfaceCard style={[styles.card, !notification.readAt && styles.cardUnread]}>
                    <View style={styles.cardMetaRow}>
                      <Text style={styles.cardTitle}>{notification.title}</Text>
                      {!notification.readAt ? <Text style={styles.unreadBadge}>Non lu</Text> : null}
                    </View>
                    <Text style={styles.cardText}>{notification.message}</Text>
                    <Text style={styles.relativeDate}>{formatRelativeDate(notification.createdAt)}</Text>

                    <View style={styles.actionsRow}>
                      {canAcceptReservation ? (
                        <ActionButton
                          label="Accepter"
                          variant="success"
                          size="sm"
                          style={styles.acceptButton}
                          onPress={() => void handleAcceptReservation(String(notification.matchId))}
                        />
                      ) : null}

                      {linkedShipment ? (
                        <ActionButton
                          label={canOpenChat ? "Ouvrir messagerie" : "Voir suivi"}
                          variant="primary"
                          size="sm"
                          style={styles.trackButton}
                          onPress={() => router.push({ pathname: "/shipment/[shipmentId]", params: { shipmentId: String(linkedShipment._id) } })}
                        />
                      ) : null}

                      {needsPayment ? (
                        <ActionButton
                          label="Payer maintenant"
                          variant="success"
                          size="sm"
                          style={styles.acceptButton}
                          onPress={() => router.push({ pathname: "/shipment/[shipmentId]", params: { shipmentId: String(linkedShipment?._id) } })}
                        />
                      ) : null}

                      {!notification.readAt ? (
                        <ActionButton
                          label="Marquer lu"
                          variant="secondary"
                          size="sm"
                          style={styles.readButton}
                          onPress={() => void handleMarkRead(String(notification._id))}
                        />
                      ) : null}
                    </View>
                  </SurfaceCard>
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
                <SurfaceCard key={notification._id} style={styles.card}>
                  <View style={styles.cardMetaRow}>
                    <Text style={styles.cardTitle}>{notification.title}</Text>
                    <Text style={styles.relativeDate}>{formatRelativeDate(notification.createdAt)}</Text>
                  </View>
                  <Text style={styles.cardText}>{notification.message}</Text>
                  {linkedShipment ? (
                    <ActionButton
                      label="Ouvrir suivi"
                      variant="primary"
                      size="sm"
                      style={[styles.trackButton, styles.historyTrackButton]}
                      onPress={() => router.push({ pathname: "/shipment/[shipmentId]", params: { shipmentId: String(linkedShipment._id) } })}
                    />
                  ) : null}
                </SurfaceCard>
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
  blockedWrap: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 24,
    gap: 12,
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
  card: {
    padding: 12,
  },
  cardUnread: {
    backgroundColor: Colors.dark.surfaceMuted,
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
  acceptButton: {},
  trackButton: {},
  historyTrackButton: {
    marginTop: 10,
    alignSelf: "flex-start",
  },
  readButton: {},
  emptyCard: {
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
