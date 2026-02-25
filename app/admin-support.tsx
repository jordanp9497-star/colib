import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/context/UserContext";
import { Colors, Fonts } from "@/constants/theme";
import { isJordanAdminName } from "@/constants/admin";

function formatDate(ts?: number) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("fr-FR");
}

export default function AdminSupportScreen() {
  const { userId, user } = useUser();
  const isAdmin = isJordanAdminName(user?.name);

  const queue = useQuery(
    api.shipments.adminListSupportQueue,
    isAdmin ? { adminVisitorId: userId, limit: 80 } : "skip"
  );

  const resendQr = useMutation(api.shipments.adminResendDeliveryQr);
  const forceReleasePayment = useMutation(api.shipments.adminForceReleasePayment);
  const confirmDeliveryAndReleasePayment = useMutation(api.shipments.adminConfirmDeliveryAndReleasePayment);

  const handleResendQr = async (shipmentId: string) => {
    try {
      const result = await resendQr({
        adminVisitorId: userId,
        shipmentId: shipmentId as any,
        reason: "Relance support BETA",
      });
      Alert.alert("QR regenere (BETA)", `Nouveau QR: ${result.qrPayload}`);
    } catch {
      Alert.alert("Erreur", "Impossible de regenerer le QR.");
    }
  };

  const handleForceRelease = async (shipmentId: string) => {
    try {
      await forceReleasePayment({
        adminVisitorId: userId,
        shipmentId: shipmentId as any,
        reason: "Validation support manuelle BETA",
      });
      Alert.alert("Paiement libere", "Le paiement a ete libere manuellement.");
    } catch {
      Alert.alert("Erreur", "Liberation du paiement impossible.");
    }
  };

  const handleConfirmDelivery = async (shipmentId: string) => {
    try {
      await confirmDeliveryAndReleasePayment({
        adminVisitorId: userId,
        shipmentId: shipmentId as any,
        reason: "Remise confirmee manuellement BETA",
      });
      Alert.alert("Remise validee", "La livraison et le paiement ont ete finalises manuellement.");
    } catch {
      Alert.alert("Erreur", "Validation manuelle impossible.");
    }
  };

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Acces refuse</Text>
        <Text style={styles.subtitle}>Ce dashboard admin BETA est reserve a Jordan.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      scrollEventThrottle={16}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={16} color={Colors.dark.textSecondary} />
        <Text style={styles.backButtonText}>Retour</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Support Admin</Text>
      <Text style={styles.subtitle}>Dashboard BETA - gestion manuelle des cas de paiement/livraison.</Text>

      {!queue ? (
        <View style={styles.centerInline}>
          <ActivityIndicator color={Colors.dark.primary} />
        </View>
      ) : queue.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Rien a traiter</Text>
          <Text style={styles.emptyText}>Aucun transport ne requiert une action support actuellement.</Text>
        </View>
      ) : (
        queue.map((entry) => (
          <View key={entry.shipment._id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Shipment {String(entry.shipment._id).slice(-6)}</Text>
              <Text style={styles.badge}>BETA</Text>
            </View>

            <Text style={styles.meta}>Statut livraison: {entry.shipment.status}</Text>
            <Text style={styles.meta}>Statut paiement: {entry.shipment.paymentStatus}</Text>
            <Text style={styles.meta}>Montant: {entry.shipment.paymentAmount} {entry.shipment.paymentCurrency}</Text>
            <Text style={styles.meta}>Destination: {entry.parcel?.origin ?? "-"} {"->"} {entry.parcel?.destination ?? "-"}</Text>
            <Text style={styles.meta}>Destinataire: {entry.parcel?.recipientPhone ?? "-"}</Text>
            <Text style={styles.meta}>SMS QR: {entry.verification?.smsStatus ?? "-"}</Text>
            <Text style={styles.meta}>QR expire le: {formatDate(entry.verification?.expiresAt)}</Text>
            <Text style={styles.meta}>QR scanne le: {formatDate(entry.verification?.scannedAt)}</Text>
            {entry.openIncident ? (
              <Text style={styles.incidentText}>
                Incident ouvert: {entry.openIncident.type} ({entry.openIncident.severity}) depuis {formatDate(entry.openIncident.openedAt)}
              </Text>
            ) : null}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionPrimary}
                onPress={() => router.push({ pathname: "/shipment/[shipmentId]", params: { shipmentId: String(entry.shipment._id) } })}
              >
                <Text style={styles.actionPrimaryText}>Ouvrir suivi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionSecondary} onPress={() => void handleResendQr(String(entry.shipment._id))}>
                <Text style={styles.actionSecondaryText}>Regenerer QR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionWarning} onPress={() => void handleForceRelease(String(entry.shipment._id))}>
                <Text style={styles.actionWarningText}>Liberer paiement</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionDanger} onPress={() => void handleConfirmDelivery(String(entry.shipment._id))}>
                <Text style={styles.actionDangerText}>Valider remise + payer</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
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
    paddingTop: 56,
    paddingBottom: 30,
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
    backgroundColor: Colors.dark.surface,
  },
  backButtonText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sansSemiBold,
  },
  title: {
    fontSize: 24,
    color: Colors.dark.text,
    fontFamily: Fonts.displaySemiBold,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sans,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    padding: 12,
    gap: 4,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 15,
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: Colors.dark.primary,
    color: Colors.dark.text,
    fontSize: 11,
    fontFamily: Fonts.sansSemiBold,
  },
  meta: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sans,
  },
  incidentText: {
    marginTop: 4,
    color: "#FCA5A5",
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  actionsRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionPrimary: {
    borderRadius: 8,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  actionPrimaryText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  actionSecondary: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  actionSecondaryText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  actionWarning: {
    borderRadius: 8,
    backgroundColor: "#B45309",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  actionWarningText: {
    color: "#FEF3C7",
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  actionDanger: {
    borderRadius: 8,
    backgroundColor: Colors.dark.error,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  actionDangerText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    padding: 14,
    gap: 6,
  },
  emptyTitle: {
    color: Colors.dark.text,
    fontSize: 15,
    fontFamily: Fonts.sansSemiBold,
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
  centerInline: {
    marginTop: 20,
    alignItems: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.background,
    padding: 20,
    gap: 8,
  },
});
