import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/context/UserContext";
import { Colors, Fonts } from "@/constants/theme";

const NEXT_STATUS: Record<string, string | null> = {
  carrier_assigned: "en_route_pickup",
  en_route_pickup: "parcel_picked_up",
  parcel_picked_up: "in_transit",
  in_transit: "near_delivery",
  near_delivery: null,
  incident_open: "incident_resolved",
  incident_resolved: "in_transit",
  delivered: null,
  cancelled: null,
};

const STATUS_LABELS: Record<string, string> = {
  carrier_assigned: "Transporteur assigne",
  en_route_pickup: "En route vers collecte",
  parcel_picked_up: "Colis recupere",
  in_transit: "En transit",
  near_delivery: "Proche de la livraison",
  incident_open: "Incident ouvert",
  incident_resolved: "Incident resolu",
  delivered: "Livre",
  cancelled: "Annule",
};

const PAYMENT_LABELS: Record<string, string> = {
  pending: "En attente",
  held: "Bloque",
  released: "Libere",
  failed: "Echoue",
};

function formatDate(ts?: number) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("fr-FR");
}

export default function ShipmentDetailsScreen() {
  const { shipmentId } = useLocalSearchParams<{ shipmentId?: string }>();
  const { userId } = useUser();
  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [openingIncident, setOpeningIncident] = useState(false);

  const shipment = useQuery(
    api.shipments.getById,
    shipmentId ? ({ shipmentId: shipmentId as any, requesterVisitorId: userId } as any) : "skip"
  );
  const timeline = useQuery(
    api.shipments.getTimeline,
    shipmentId ? ({ shipmentId: shipmentId as any, requesterVisitorId: userId } as any) : "skip"
  );
  const live = useQuery(
    api.shipments.getLiveTracking,
    shipmentId ? ({ shipmentId: shipmentId as any, requesterVisitorId: userId, limit: 10 } as any) : "skip"
  );
  const messages = useQuery(
    api.shipments.listMessages,
    shipmentId ? ({ shipmentId: shipmentId as any, requesterVisitorId: userId, limit: 100 } as any) : "skip"
  );
  const paymentState = useQuery(
    api.shipments.getPaymentAndDeliveryState,
    shipmentId ? ({ shipmentId: shipmentId as any, requesterVisitorId: userId } as any) : "skip"
  );

  const updateStatus = useMutation(api.shipments.updateStatus);
  const sendMessage = useMutation(api.shipments.sendMessage);
  const openIncident = useMutation(api.shipments.openIncident);
  const confirmPaymentHold = useMutation(api.shipments.confirmPaymentHold);

  const role = useMemo(() => {
    if (!shipment) return null;
    return shipment.carrierVisitorId === userId ? "carrier" : "customer";
  }, [shipment, userId]);

  if (shipment === undefined || timeline === undefined || live === undefined || messages === undefined || paymentState === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!shipment || !timeline) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Transport introuvable</Text>
      </View>
    );
  }

  const suggestedNext = NEXT_STATUS[shipment.status] ?? null;
  const suggestedNextLabel = suggestedNext ? (STATUS_LABELS[suggestedNext] ?? suggestedNext) : null;
  const reservationAccepted = paymentState?.reservationAccepted ?? false;
  const canAdvance =
    reservationAccepted &&
    suggestedNext !== null &&
    ((role === "carrier" && suggestedNext !== "delivered") || suggestedNext === "delivered");

  const handlePayAndBlockFunds = async () => {
    try {
      await confirmPaymentHold({
        shipmentId: shipment._id,
        actorVisitorId: userId,
      });
      Alert.alert("Paiement securise", "Le paiement est bloque et le QR a ete envoye au destinataire par SMS.");
    } catch {
      Alert.alert("Erreur", "Impossible de securiser le paiement pour le moment.");
    }
  };

  const handleAdvanceStatus = async () => {
    if (!suggestedNext) return;
    setUpdatingStatus(true);
    try {
      await updateStatus({
        shipmentId: shipment._id,
        actorVisitorId: userId,
        nextStatus: suggestedNext as any,
      });
    } catch {
      Alert.alert("Erreur", "Impossible de mettre a jour le statut.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSendMessage = async () => {
    const body = messageDraft.trim();
    if (!body) return;
    setSendingMessage(true);
    try {
      await sendMessage({
        shipmentId: shipment._id,
        senderVisitorId: userId,
        body,
      });
      setMessageDraft("");
    } catch {
      Alert.alert("Erreur", "Impossible d envoyer ce message.");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleOpenIncident = async () => {
    setOpeningIncident(true);
    try {
      await openIncident({
        shipmentId: shipment._id,
        actorVisitorId: userId,
        type: "delay",
        severity: "medium",
        description: "Retard signale depuis l application mobile",
      });
    } catch {
      Alert.alert("Erreur", "Impossible d ouvrir un incident pour le moment.");
    } finally {
      setOpeningIncident(false);
    }
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

      <Text style={styles.title}>Suivi du transport</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Etat actuel</Text>
        <View style={styles.row}>
          <Ionicons name="cube-outline" size={16} color="#2563EB" />
          <Text style={styles.value}>{STATUS_LABELS[shipment.status] ?? shipment.status}</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="wallet-outline" size={16} color="#0EA5E9" />
          <Text style={styles.value}>Paiement: {PAYMENT_LABELS[shipment.paymentStatus] ?? shipment.paymentStatus}</Text>
        </View>
        <Text style={styles.metaLine}>
          Montant: {shipment.paymentAmount} {shipment.paymentCurrency}
        </Text>
        {shipment.paymentHeldAt ? <Text style={styles.metaLine}>Paiement bloque le: {formatDate(shipment.paymentHeldAt)}</Text> : null}
        {shipment.paymentReleasedAt ? (
          <Text style={styles.metaLine}>Paiement libere le: {formatDate(shipment.paymentReleasedAt)}</Text>
        ) : null}
        <Text style={styles.metaLine}>Assurance eligibilite: {shipment.insuranceEligible ? "OK" : "Bloquee"}</Text>
        <Text style={styles.metaLine}>Dernier tracking: {formatDate(shipment.lastTrackingAt)}</Text>
        {shipment.deliveredAt ? <Text style={styles.metaLine}>Livre le: {formatDate(shipment.deliveredAt)}</Text> : null}

        {!reservationAccepted ? (
          <View style={styles.pendingBanner}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors.dark.warning} />
            <Text style={styles.pendingBannerText}>Demande en attente: echangez avec le proposeur avant validation.</Text>
          </View>
        ) : null}

        {paymentState?.verification?.smsStatus ? (
          <Text style={styles.metaLine}>SMS destinataire: {paymentState.verification.smsStatus}</Text>
        ) : null}
        {paymentState?.verification?.expiresAt ? (
          <Text style={styles.metaLine}>QR expire le: {formatDate(paymentState.verification.expiresAt)}</Text>
        ) : null}

        {paymentState?.canPay ? (
          <TouchableOpacity style={styles.payButton} onPress={handlePayAndBlockFunds}>
            <Text style={styles.primaryButtonText}>Payer et bloquer les fonds</Text>
          </TouchableOpacity>
        ) : null}

        {role === "customer" && paymentState?.verification?.qrPayload ? (
          <View style={styles.qrBlock}>
            <Text style={styles.qrLabel}>QR de remise (a afficher au destinataire)</Text>
            <Text style={styles.qrValue}>{paymentState.verification.qrPayload}</Text>
          </View>
        ) : null}

        {paymentState?.canScanQr ? (
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => router.push({ pathname: "/shipment-scan" as any, params: { shipmentId: String(shipment._id) } })}
          >
            <Ionicons name="scan-outline" size={16} color="#FFFFFF" />
            <Text style={styles.warningButtonText}>Scanner le QR de remise</Text>
          </TouchableOpacity>
        ) : null}

        {canAdvance ? (
          <TouchableOpacity
            style={[styles.primaryButton, updatingStatus && styles.buttonDisabled]}
            disabled={updatingStatus}
            onPress={handleAdvanceStatus}
          >
            {updatingStatus ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Passer a {suggestedNextLabel}</Text>
            )}
          </TouchableOpacity>
        ) : null}

        {reservationAccepted && shipment.status !== "delivered" && shipment.status !== "cancelled" ? (
          <TouchableOpacity
            style={[styles.warningButton, openingIncident && styles.buttonDisabled]}
            onPress={handleOpenIncident}
            disabled={openingIncident}
          >
            {openingIncident ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.warningButtonText}>Signaler un incident</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Tracking en temps reel</Text>
        {live?.latest ? (
          <>
            <Text style={styles.metaLine}>Latitude: {live.latest.lat.toFixed(5)}</Text>
            <Text style={styles.metaLine}>Longitude: {live.latest.lng.toFixed(5)}</Text>
            <Text style={styles.metaLine}>Horodatage: {formatDate(live.latest.recordedAt)}</Text>
          </>
        ) : (
          <Text style={styles.emptyText}>Aucun point GPS recu pour le moment.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Timeline</Text>
        {timeline.events.length === 0 ? (
          <Text style={styles.emptyText}>Aucun evenement.</Text>
        ) : (
          timeline.events.map((event) => (
            <View key={event._id} style={styles.eventRow}>
              <Text style={styles.eventType}>{event.eventType}</Text>
              <Text style={styles.eventDate}>{formatDate(event.createdAt)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Messagerie securisee</Text>
        {messages.length === 0 ? <Text style={styles.emptyText}>Aucun message.</Text> : null}
        {messages.map((msg) => (
          <View
            key={msg._id}
            style={[
              styles.messageBubble,
              msg.senderVisitorId === userId ? styles.myMessageBubble : styles.otherMessageBubble,
            ]}
          >
            <Text style={styles.messageRole}>{msg.senderRole}</Text>
            <Text style={styles.messageText}>{msg.body}</Text>
            <Text style={styles.messageDate}>{formatDate(msg.createdAt)}</Text>
          </View>
        ))}

        <View style={styles.messageComposer}>
          <TextInput
            value={messageDraft}
            onChangeText={setMessageDraft}
            placeholder="Ecrire un message"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, sendingMessage && styles.buttonDisabled]}
            disabled={sendingMessage}
            onPress={handleSendMessage}
          >
            {sendingMessage ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="send" size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 12,
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
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F141A",
  },
  title: {
    fontSize: 24,
    color: Colors.dark.text,
    marginBottom: 4,
    fontFamily: Fonts.displaySemiBold,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 15,
    color: Colors.dark.text,
    marginBottom: 10,
    fontFamily: Fonts.sansSemiBold,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  value: {
    fontSize: 14,
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
    textTransform: "capitalize",
  },
  metaLine: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
    fontFamily: Fonts.sans,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: Colors.dark.text,
    fontSize: 13,
    textTransform: "capitalize",
    fontFamily: Fonts.sansSemiBold,
  },
  warningButton: {
    marginTop: 8,
    backgroundColor: "#DC2626",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  payButton: {
    marginTop: 8,
    backgroundColor: "#059669",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  scanButton: {
    marginTop: 8,
    backgroundColor: "#0EA5E9",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  qrBlock: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#0B1220",
    gap: 6,
  },
  pendingBanner: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: Colors.dark.warning,
    borderRadius: 10,
    backgroundColor: "#2A210B",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  pendingBannerText: {
    flex: 1,
    color: Colors.dark.warning,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Fonts.sansSemiBold,
  },
  qrLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sansSemiBold,
  },
  qrValue: {
    fontSize: 13,
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
  },
  warningButtonText: {
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  emptyTitle: {
    fontSize: 18,
    color: Colors.dark.text,
    fontFamily: Fonts.displaySemiBold,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sans,
  },
  eventRow: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    paddingVertical: 8,
  },
  eventType: {
    fontSize: 13,
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
  },
  eventDate: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
    fontFamily: Fonts.sans,
  },
  messageBubble: {
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  myMessageBubble: {
    backgroundColor: Colors.dark.primaryLight,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  otherMessageBubble: {
    backgroundColor: Colors.dark.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  messageRole: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
    textTransform: "uppercase",
    fontFamily: Fonts.sansSemiBold,
  },
  messageText: {
    fontSize: 14,
    color: Colors.dark.text,
    fontFamily: Fonts.sans,
  },
  messageDate: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 6,
    fontFamily: Fonts.sans,
  },
  messageComposer: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: "#161D24",
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.dark.text,
    fontFamily: Fonts.sans,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#0EA5E9",
    alignItems: "center",
    justifyContent: "center",
  },
});
