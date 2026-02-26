import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";

const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  carrier_assigned: "Transporteur assigne",
  en_route_pickup: "En route collecte",
  parcel_picked_up: "Colis recupere",
  in_transit: "En transit",
  near_delivery: "Proche de la livraison",
  delivered: "Livre",
  incident_open: "Incident ouvert",
  incident_resolved: "Incident resolu",
  cancelled: "Annule",
};

const SHIPMENT_PAYMENT_LABELS: Record<string, string> = {
  pending: "En attente",
  held: "Bloque",
  release_pending: "Liberation en cours",
  released: "Libere",
  failed: "Echoue",
};

type HistoryItem = {
  id: string;
  role: "transporteur" | "expediteur";
  status: string;
  paymentStatus: string;
  amount: number;
  currency: string;
  updatedAt: number;
  deliveredAt?: number;
};

type Props = {
  open: boolean;
  onToggle: () => void;
  shippedAsCarrier: number;
  shippedAsSender: number;
  completedHistory: HistoryItem[];
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateOnly(timestamp?: number) {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleDateString("fr-FR");
}

export function ProfileHistorySection({ open, onToggle, shippedAsCarrier, shippedAsSender, completedHistory }: Props) {
  return (
    <View style={styles.foldSection}>
      <TouchableOpacity style={styles.foldHeader} onPress={onToggle} activeOpacity={0.85}>
        <Text style={styles.foldTitle}>Historique</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={Colors.dark.textSecondary} />
      </TouchableOpacity>
      {open ? (
        <View style={styles.foldBody}>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Colis transportes / envoyes</Text>
            <View style={styles.historySummaryRow}>
              <View style={styles.historySummaryCard}>
                <Text style={styles.historySummaryValue}>{shippedAsCarrier}</Text>
                <Text style={styles.historySummaryLabel}>Transportes</Text>
              </View>
              <View style={styles.historySummaryCard}>
                <Text style={styles.historySummaryValue}>{shippedAsSender}</Text>
                <Text style={styles.historySummaryLabel}>Envoyes</Text>
              </View>
            </View>

            {completedHistory.length > 0 ? (
              completedHistory.map((entry) => (
                <View key={entry.id} style={styles.historyRow}>
                  <View style={styles.historyTopRow}>
                    <View style={styles.historyBadgeWrap}>
                      <Text style={[styles.historyBadge, entry.role === "transporteur" ? styles.historyCarrierBadge : styles.historySenderBadge]}>
                        {entry.role === "transporteur" ? "Transporte" : "Envoye"}
                      </Text>
                    </View>
                    <Text style={styles.historyAmount}>{formatMoney(entry.amount, entry.currency)}</Text>
                  </View>
                  <Text style={styles.historyStatus}>{SHIPMENT_STATUS_LABELS[entry.status] ?? entry.status}</Text>
                  <Text style={styles.historyMeta}>
                    Paiement: {SHIPMENT_PAYMENT_LABELS[entry.paymentStatus] ?? entry.paymentStatus} - {formatDateOnly(entry.deliveredAt ?? entry.updatedAt)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptySection}>Aucun transport livre pour le moment.</Text>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  foldSection: {
    borderRadius: 12,
    borderWidth: 0,
    backgroundColor: Colors.dark.surface,
    marginBottom: 10,
    overflow: "hidden",
  },
  foldHeader: {
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.dark.surfaceMuted,
  },
  foldTitle: {
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  foldBody: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 2,
  },
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 16,
    color: Colors.dark.text,
    marginBottom: 10,
    fontFamily: Fonts.sansSemiBold,
  },
  historySummaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  historySummaryCard: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  historySummaryValue: {
    color: Colors.dark.text,
    fontSize: 18,
    fontFamily: Fonts.displaySemiBold,
  },
  historySummaryLabel: {
    marginTop: 2,
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  historyRow: {
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  historyTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  historyBadgeWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  historyBadge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 11,
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
  },
  historyCarrierBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.22)",
  },
  historySenderBadge: {
    backgroundColor: "rgba(47, 128, 237, 0.22)",
  },
  historyAmount: {
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  historyStatus: {
    marginTop: 8,
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  historyMeta: {
    marginTop: 3,
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  emptySection: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontStyle: "italic",
    marginBottom: 8,
    fontFamily: Fonts.sans,
  },
});
