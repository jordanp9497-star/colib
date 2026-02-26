import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/context/UserContext";
import { useActiveTrip } from "@/context/ActiveTripContext";
import { BackButton } from "@/components/ui/back-button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Colors, Fonts } from "@/constants/theme";

export default function ActiveTripMatchesScreen() {
  const { userId } = useUser();
  const { activeSession } = useActiveTrip();
  const params = useLocalSearchParams<{ tripSessionId?: string }>();
  const tripSessionId =
    typeof params.tripSessionId === "string"
      ? params.tripSessionId
      : activeSession?.tripSessionId;

  const matches = useQuery(
    (api as any).tripSessions.listMatches,
    tripSessionId
      ? {
          tripSessionId,
          userId,
          limit: 50,
        }
      : "skip"
  ) as any[] | undefined;

  if (!tripSessionId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Aucun trajet actif</Text>
      </View>
    );
  }

  if (matches === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as any))} />

      <Text style={styles.title}>Colis compatibles</Text>
      <Text style={styles.subtitle}>
        Trajet vers {activeSession?.destinationLabel ?? "destination"} - deviation max {activeSession?.deviationMaxMinutes ?? "-"} min
      </Text>

      <FlatList
        data={matches}
        keyExtractor={(item) => item.parcelId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <SurfaceCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aucun colis compatible pour le moment</Text>
            <Text style={styles.emptyText}>Continuez votre trajet, on vous notifiera en cas de nouvelle opportunite.</Text>
          </SurfaceCard>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => router.push(`/parcel/${item.parcelId}` as any)}>
            <Text style={styles.pickup} numberOfLines={1}>
              Pickup: {item.pickupLabel}
            </Text>
            <Text style={styles.drop} numberOfLines={1}>
              Drop: {item.dropLabel}
            </Text>
            <Text style={styles.meta}>
              Detour estime: {item.estimatedDetourMinutes} min - Score: {item.score}
            </Text>
            <Text style={styles.cta}>Voir details</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    padding: 16,
    paddingTop: 56,
  },
  title: { fontSize: 24, fontFamily: Fonts.displaySemiBold, color: Colors.dark.text },
  subtitle: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sans,
  },
  list: {
    gap: 10,
    paddingBottom: 24,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    padding: 12,
  },
  pickup: {
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
    color: Colors.dark.text,
  },
  drop: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sans,
  },
  meta: {
    marginTop: 6,
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  cta: {
    marginTop: 8,
    color: Colors.dark.primary,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
  },
  emptyCard: {
    marginTop: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    padding: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: Fonts.sansSemiBold,
    color: Colors.dark.text,
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sans,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.background,
  },
});
