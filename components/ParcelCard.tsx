import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Parcel {
  _id: string;
  userName: string;
  origin: string;
  destination: string;
  size: "petit" | "moyen" | "grand";
  weight: number;
  description: string;
  phone?: string;
  status: "pending" | "matched" | "delivered";
}

const sizeConfig = {
  petit: { label: "Petit", color: "#22C55E" },
  moyen: { label: "Moyen", color: "#F59E0B" },
  grand: { label: "Grand", color: "#6366F1" },
};

const statusConfig = {
  pending: { label: "En attente", color: "#F59E0B", icon: "time-outline" as const },
  matched: { label: "Pris en charge", color: "#22C55E", icon: "checkmark-circle-outline" as const },
  delivered: { label: "Livre", color: "#6366F1", icon: "cube" as const },
};

export default function ParcelCard({ parcel }: { parcel: Parcel }) {
  const size = sizeConfig[parcel.size];
  const status = statusConfig[parcel.status];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.route}>
          <Text style={styles.city}>{parcel.origin}</Text>
          <Ionicons name="arrow-forward" size={18} color="#94A3B8" />
          <Text style={styles.city}>{parcel.destination}</Text>
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
          <Ionicons name="scale-outline" size={14} color="#64748B" />
          <Text style={styles.detailText}>{parcel.weight} kg</Text>
        </View>
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {parcel.description}
      </Text>

      <View style={styles.footer}>
        <View style={styles.user}>
          <Ionicons name="person-circle-outline" size={18} color="#64748B" />
          <Text style={styles.userName}>{parcel.userName}</Text>
        </View>
        {parcel.phone ? (
          <View style={styles.detailItem}>
            <Ionicons name="call-outline" size={14} color="#64748B" />
            <Text style={styles.detailText}>{parcel.phone}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  route: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  city: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1E293B",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  details: {
    flexDirection: "row",
    alignItems: "center",
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
    color: "#64748B",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  description: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 8,
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  user: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  userName: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
});
