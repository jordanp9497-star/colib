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

const NEXT_STATUS: Record<string, string | null> = {
  carrier_assigned: "en_route_pickup",
  en_route_pickup: "parcel_picked_up",
  parcel_picked_up: "in_transit",
  in_transit: "near_delivery",
  near_delivery: "delivered",
  incident_open: "incident_resolved",
  incident_resolved: "in_transit",
  delivered: null,
  cancelled: null,
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

  const updateStatus = useMutation(api.shipments.updateStatus);
  const sendMessage = useMutation(api.shipments.sendMessage);
  const openIncident = useMutation(api.shipments.openIncident);

  const role = useMemo(() => {
    if (!shipment) return null;
    return shipment.carrierVisitorId === userId ? "carrier" : "customer";
  }, [shipment, userId]);

  if (shipment === undefined || timeline === undefined || live === undefined || messages === undefined) {
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
  const canAdvance =
    suggestedNext !== null &&
    ((role === "carrier" && suggestedNext !== "delivered") || suggestedNext === "delivered");

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={16} color="#334155" />
        <Text style={styles.backButtonText}>Precedent</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Suivi du transport</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Etat actuel</Text>
        <View style={styles.row}>
          <Ionicons name="cube-outline" size={16} color="#2563EB" />
          <Text style={styles.value}>{shipment.status}</Text>
        </View>
        <Text style={styles.metaLine}>Assurance eligibilite: {shipment.insuranceEligible ? "OK" : "Bloquee"}</Text>
        <Text style={styles.metaLine}>Dernier tracking: {formatDate(shipment.lastTrackingAt)}</Text>
        {shipment.deliveredAt ? <Text style={styles.metaLine}>Livre le: {formatDate(shipment.deliveredAt)}</Text> : null}

        {canAdvance ? (
          <TouchableOpacity
            style={[styles.primaryButton, updatingStatus && styles.buttonDisabled]}
            disabled={updatingStatus}
            onPress={handleAdvanceStatus}
          >
            {updatingStatus ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Passer a {suggestedNext}</Text>
            )}
          </TouchableOpacity>
        ) : null}

        {shipment.status !== "delivered" && shipment.status !== "cancelled" ? (
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
    backgroundColor: "#0F141A",
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
    borderColor: "#CBD5E1",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 4,
    backgroundColor: "#161D24",
  },
  backButtonText: { fontSize: 12, fontWeight: "700", color: "#334155" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F141A",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  card: {
    backgroundColor: "#161D24",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  value: {
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "700",
    textTransform: "capitalize",
  },
  metaLine: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 4,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
    textTransform: "capitalize",
  },
  warningButton: {
    marginTop: 8,
    backgroundColor: "#DC2626",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  warningButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  emptyTitle: {
    fontSize: 18,
    color: "#0F172A",
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 13,
    color: "#94A3B8",
  },
  eventRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingVertical: 8,
  },
  eventType: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  eventDate: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  messageBubble: {
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  myMessageBubble: {
    backgroundColor: "#DBEAFE",
    borderWidth: 1,
    borderColor: "#93C5FD",
  },
  otherMessageBubble: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  messageRole: {
    fontSize: 11,
    color: "#64748B",
    marginBottom: 4,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  messageText: {
    fontSize: 14,
    color: "#1E293B",
  },
  messageDate: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 6,
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
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1E293B",
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
