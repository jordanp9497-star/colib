import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type BadgeType =
  | "email_verified"
  | "identity_none"
  | "identity_pending"
  | "identity_verified"
  | "identity_rejected"
  | "beta";

interface VerificationBadgeProps {
  type: BadgeType;
}

const CONFIG: Record<
  BadgeType,
  { label: string; icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string }
> = {
  email_verified: {
    label: "Email verifie",
    icon: "checkmark-circle",
    bg: "#DCFCE7",
    fg: "#16A34A",
  },
  identity_none: {
    label: "Non verifie",
    icon: "shield-outline",
    bg: "#F1F5F9",
    fg: "#94A3B8",
  },
  identity_pending: {
    label: "En attente",
    icon: "time-outline",
    bg: "#FEF3C7",
    fg: "#D97706",
  },
  identity_verified: {
    label: "Identite verifiee",
    icon: "shield-checkmark",
    bg: "#DCFCE7",
    fg: "#16A34A",
  },
  identity_rejected: {
    label: "Rejete",
    icon: "close-circle",
    bg: "#FEE2E2",
    fg: "#DC2626",
  },
  beta: {
    label: "BETA",
    icon: "flask",
    bg: "#EEF2FF",
    fg: "#6366F1",
  },
};

export default function VerificationBadge({ type }: VerificationBadgeProps) {
  const config = CONFIG[type];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Ionicons name={config.icon} size={12} color={config.fg} />
      <Text style={[styles.text, { color: config.fg }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
  },
});
