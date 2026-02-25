import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";

interface Parcel {
  _id: string;
  userName: string;
  origin: string;
  destination: string;
  size: "petit" | "moyen" | "grand";
  weight: number;
  description: string;
  phone?: string;
  status:
    | "draft"
    | "pending"
    | "published"
    | "matched"
    | "booked"
    | "completed"
    | "delivered"
    | "cancelled";
}

const sizeConfig = {
  petit: { label: "Petit", color: Colors.dark.success },
  moyen: { label: "Moyen", color: Colors.dark.warning },
  grand: { label: "Grand", color: Colors.dark.primary },
};

const statusConfig = {
  draft: { label: "Brouillon", color: "#94A3B8", icon: "document-outline" as const },
  pending: { label: "En attente", color: "#F59E0B", icon: "time-outline" as const },
  published: { label: "Publie", color: Colors.dark.primary, icon: "radio-outline" as const },
  matched: { label: "Pris en charge", color: "#22C55E", icon: "checkmark-circle-outline" as const },
  booked: { label: "Reserve", color: "#0EA5E9", icon: "bookmark-outline" as const },
  completed: { label: "Termine", color: "#6366F1", icon: "checkmark-done-outline" as const },
  delivered: { label: "Livre", color: "#6366F1", icon: "cube" as const },
  cancelled: { label: "Annule", color: "#EF4444", icon: "close-circle-outline" as const },
};

export default function ParcelCard({
  parcel,
  onEdit,
  onDelete,
}: {
  parcel: Parcel;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const size = sizeConfig[parcel.size];
  const status = statusConfig[parcel.status] ?? statusConfig.published;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.routePanel}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: "#2563EB" }]} />
            <View style={styles.routeTextWrap}>
              <Text style={styles.routeLabel}>Recuperation</Text>
              <Text style={styles.routeAddress} numberOfLines={2} ellipsizeMode="tail">
                {parcel.origin}
              </Text>
            </View>
          </View>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: "#16A34A" }]} />
            <View style={styles.routeTextWrap}>
              <Text style={styles.routeLabel}>Livraison</Text>
              <Text style={styles.routeAddress} numberOfLines={2} ellipsizeMode="tail">
                {parcel.destination}
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.color + "20" }]}>
          <Ionicons name={status.icon} size={12} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={[styles.badge, { backgroundColor: size.color + "20" }]}>
          <Text style={[styles.badgeText, { color: size.color }]}>
            {size.label}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="scale-outline" size={14} color={Colors.dark.textSecondary} />
          <Text style={styles.detailText}>{parcel.weight} kg</Text>
        </View>
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {parcel.description}
      </Text>

      <View style={styles.footer}>
        <View style={styles.user}>
          <Ionicons name="person-circle-outline" size={18} color={Colors.dark.textSecondary} />
          <Text style={styles.userName}>{parcel.userName}</Text>
        </View>
        {parcel.phone ? (
          <View style={styles.detailItem}>
            <Ionicons name="call-outline" size={14} color={Colors.dark.textSecondary} />
            <Text style={styles.detailText}>{parcel.phone}</Text>
          </View>
        ) : null}
      </View>

      {onEdit || onDelete ? (
        <View style={styles.actionsRow}>
          {onEdit ? (
            <TouchableOpacity style={styles.editButton} onPress={onEdit}>
              <Text style={styles.editButtonText}>Modifier</Text>
            </TouchableOpacity>
          ) : null}
          {onDelete ? (
            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
              <Text style={styles.deleteButtonText}>Supprimer</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  header: {
    gap: 10,
    marginBottom: 12,
  },
  routePanel: {
    backgroundColor: Colors.dark.surfaceMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 10,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  routeTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  routeLabel: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 2,
    fontFamily: Fonts.sansSemiBold,
  },
  routeAddress: {
    fontSize: 14,
    color: Colors.dark.text,
    flexShrink: 1,
    fontFamily: Fonts.sansSemiBold,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontFamily: Fonts.sansSemiBold,
  },
  details: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sans,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  description: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
    fontFamily: Fonts.sans,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  user: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  userName: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    maxWidth: 150,
    fontFamily: Fonts.sans,
  },
  actionsRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: Colors.dark.primaryLight,
  },
  editButtonText: {
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  deleteButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#FEF2F2",
  },
  deleteButtonText: {
    color: "#B91C1C",
    fontWeight: "700",
    fontSize: 13,
  },
});
