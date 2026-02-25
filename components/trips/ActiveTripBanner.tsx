import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useActiveTrip } from "@/context/ActiveTripContext";
import { Colors, Fonts } from "@/constants/theme";

export function ActiveTripBanner() {
  const { activeSession, stopTrip } = useActiveTrip();

  if (!activeSession) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>
        Trajet actif vers {activeSession.destinationLabel}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {activeSession.deviationMaxMinutes} min de deviation - {activeSession.matchesCount} colis dispo
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            router.push({
              pathname: "/trip/active-matches",
              params: { tripSessionId: activeSession.tripSessionId },
            } as any)
          }
        >
          <Text style={styles.primaryButtonText}>Voir les colis</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            Alert.alert("Arreter ce trajet", "Vous ne recevrez plus d'opportunites pour cette session.", [
              { text: "Annuler", style: "cancel" },
              {
                text: "Arreter",
                style: "destructive",
                onPress: () => {
                  void stopTrip();
                },
              },
            ]);
          }}
        >
          <Text style={styles.secondaryButtonText}>Arreter</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    padding: 10,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  subtitle: {
    marginTop: 2,
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  actions: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.primary,
  },
  primaryButtonText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  secondaryButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  secondaryButtonText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
});
