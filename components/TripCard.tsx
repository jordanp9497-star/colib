import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatShortAddress } from "@/utils/address";

interface Trip {
  _id: string;
  userName: string;
  origin: string;
  destination: string;
  originAddress?: {
    label?: string;
    city?: string;
    postalCode?: string;
  };
  destinationAddress?: {
    label?: string;
    city?: string;
    postalCode?: string;
  };
  date: string;
  availableSpace: "petit" | "moyen" | "grand";
  price: number;
  description?: string;
  phone?: string;
}

const spaceConfig = {
  petit: { label: "Petit", color: "#22C55E" },
  moyen: { label: "Moyen", color: "#F59E0B" },
  grand: { label: "Grand", color: "#6366F1" },
};

export default function TripCard({
  trip,
  onEdit,
  onDelete,
}: {
  trip: Trip;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const space = spaceConfig[trip.availableSpace];
  const shortOrigin = formatShortAddress(trip.originAddress, trip.origin);
  const shortDestination = formatShortAddress(trip.destinationAddress, trip.destination);

  return (
    <View style={styles.card}>
      <View style={styles.routePanel}>
        <View style={styles.routeRow}>
          <View style={[styles.routeDot, { backgroundColor: "#2563EB" }]} />
          <View style={styles.routeTextWrap}>
            <Text style={styles.routeLabel}>Depart</Text>
            <Text style={styles.routeAddress} numberOfLines={2} ellipsizeMode="tail">
              {shortOrigin}
            </Text>
          </View>
        </View>
        <View style={styles.routeRow}>
          <View style={[styles.routeDot, { backgroundColor: "#16A34A" }]} />
          <View style={styles.routeTextWrap}>
            <Text style={styles.routeLabel}>Arrivee</Text>
            <Text style={styles.routeAddress} numberOfLines={2} ellipsizeMode="tail">
              {shortDestination}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={14} color="#64748B" />
          <Text style={styles.detailText}>{trip.date}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: space.color + "20" }]}>
          <Text style={[styles.badgeText, { color: space.color }]}>
            {space.label}
          </Text>
        </View>
        <Text style={styles.price}>{trip.price} EUR</Text>
      </View>

      {trip.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {trip.description}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.user}>
          <Ionicons name="person-circle-outline" size={18} color="#64748B" />
          <Text style={styles.userName}>{trip.userName}</Text>
        </View>
        {trip.phone ? (
          <View style={styles.detailItem}>
            <Ionicons name="call-outline" size={14} color="#64748B" />
            <Text style={styles.detailText}>{trip.phone}</Text>
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
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  routePanel: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    marginBottom: 12,
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
    color: "#64748B",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    flexShrink: 1,
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
  price: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6366F1",
    marginLeft: "auto",
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
    gap: 8,
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
    maxWidth: 150,
  },
  actionsRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#4F46E5",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#EEF2FF",
  },
  editButtonText: {
    color: "#3730A3",
    fontWeight: "700",
    fontSize: 13,
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
