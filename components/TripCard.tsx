import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Trip {
  _id: string;
  userName: string;
  origin: string;
  destination: string;
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

export default function TripCard({ trip }: { trip: Trip }) {
  const space = spaceConfig[trip.availableSpace];

  return (
    <View style={styles.card}>
      <View style={styles.route}>
        <Text style={styles.city}>{trip.origin}</Text>
        <Ionicons name="arrow-forward" size={18} color="#94A3B8" />
        <Text style={styles.city}>{trip.destination}</Text>
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
  route: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  city: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1E293B",
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
