import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";

type Props = {
  open: boolean;
  onToggle: () => void;
  walletReleased: number;
  walletPending: number;
  walletSpent: number;
  walletCompletedPayouts: number;
  currency: string;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ProfileWalletSection({
  open,
  onToggle,
  walletReleased,
  walletPending,
  walletSpent,
  walletCompletedPayouts,
  currency,
}: Props) {
  return (
    <View style={styles.foldSection}>
      <TouchableOpacity style={styles.foldHeader} onPress={onToggle} activeOpacity={0.85}>
        <Text style={styles.foldTitle}>Portefeuille</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={Colors.dark.textSecondary} />
      </TouchableOpacity>
      {open ? (
        <View style={styles.foldBody}>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Suivi des gains</Text>
            <View style={styles.walletGrid}>
              <View style={styles.walletCard}>
                <Text style={styles.walletLabel}>Disponible</Text>
                <Text style={styles.walletValue}>{formatMoney(walletReleased, currency)}</Text>
                <Text style={styles.walletHint}>Paiements liberes</Text>
              </View>
              <View style={styles.walletCard}>
                <Text style={styles.walletLabel}>En attente</Text>
                <Text style={styles.walletValue}>{formatMoney(walletPending, currency)}</Text>
                <Text style={styles.walletHint}>Escrow en cours</Text>
              </View>
            </View>
            <View style={styles.walletFooter}>
              <Text style={styles.walletFooterText}>Transactions finalisees: {walletCompletedPayouts}</Text>
              <Text style={styles.walletFooterText}>Depense expediteur: {formatMoney(walletSpent, currency)}</Text>
            </View>
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
  walletGrid: {
    flexDirection: "row",
    gap: 10,
  },
  walletCard: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  walletLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  walletValue: {
    marginTop: 6,
    color: Colors.dark.text,
    fontSize: 17,
    fontFamily: Fonts.displaySemiBold,
  },
  walletHint: {
    marginTop: 4,
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontFamily: Fonts.sans,
  },
  walletFooter: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  walletFooterText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
});
