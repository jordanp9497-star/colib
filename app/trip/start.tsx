import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { AddressAutocompleteInput } from "@/components/maps/AddressAutocompleteInput";
import type { GeocodedAddress } from "@/packages/shared/maps";
import { useActiveTrip } from "@/context/ActiveTripContext";
import { Colors, Fonts } from "@/constants/theme";

const DEVIATION_OPTIONS = [5, 10, 20, 30] as const;

export default function StartTripScreen() {
  const { startTrip, activeSession } = useActiveTrip();
  const [origin, setOrigin] = useState<GeocodedAddress | null>(null);
  const [destination, setDestination] = useState<GeocodedAddress | null>(null);
  const [deviationMaxMinutes, setDeviationMaxMinutes] = useState<(typeof DEVIATION_OPTIONS)[number]>(10);
  const [opportunitiesEnabled, setOpportunitiesEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingCurrentLocation, setLoadingCurrentLocation] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadCurrentLocation = async () => {
      if (Platform.OS === "web") {
        setLoadingCurrentLocation(false);
        return;
      }

      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          setLoadingCurrentLocation(false);
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!mounted) return;

        const reverse = await Location.reverseGeocodeAsync({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
        const first = reverse[0];

        setOrigin({
          placeId: "current-location",
          label:
            first && (first.street || first.city)
              ? `${first.street ?? ""}${first.street && first.city ? ", " : ""}${first.city ?? ""}`
              : "Ma position",
          city: first?.city ?? undefined,
          postalCode: first?.postalCode ?? undefined,
          countryCode: first?.isoCountryCode ?? undefined,
          lat: current.coords.latitude,
          lng: current.coords.longitude,
        });
      } catch {
        if (mounted) {
          // Keep manual origin input fallback.
        }
      } finally {
        if (mounted) setLoadingCurrentLocation(false);
      }
    };

    void loadCurrentLocation();

    return () => {
      mounted = false;
    };
  }, []);

  const canSubmit = useMemo(() => Boolean(origin && destination && !activeSession), [activeSession, destination, origin]);

  const handleLaunch = async () => {
    if (!origin || !destination) {
      Alert.alert("Trajet incomplet", "Renseignez un depart et une destination.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await startTrip({
        origin,
        destination,
        deviationMaxMinutes,
        opportunitiesEnabled,
      });

      if (!result.success) {
        if (result.error === "location_foreground_denied") {
          Alert.alert("Localisation requise", "Autorisez la localisation pour demarrer un trajet.");
        } else if (result.error === "location_background_denied") {
          Alert.alert(
            "Localisation arriere-plan requise",
            "Activez la localisation en arriere-plan pour recevoir des opportunites pendant la conduite."
          );
        } else if (result.error === "notifications_denied") {
          Alert.alert("Notifications desactivees", "Activez les notifications pour recevoir les opportunites trajet.");
        } else {
          Alert.alert("Erreur", "Impossible de demarrer le trajet pour le moment.");
        }
        return;
      }

      router.replace("/(tabs)" as any);
    } catch {
      Alert.alert("Erreur", "Le trajet n'a pas pu etre lance.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace("/(tabs)" as any)}>
          <Ionicons name="arrow-back" size={16} color={Colors.dark.textSecondary} />
          <Text style={styles.backButtonText}>Retour accueil</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Demarrer un trajet</Text>
        <Text style={styles.subtitle}>1 a 2 taps pour activer votre trajet et recevoir des colis compatibles.</Text>

        {loadingCurrentLocation ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={Colors.dark.primary} />
            <Text style={styles.loadingText}>Position actuelle en cours...</Text>
          </View>
        ) : null}

        <AddressAutocompleteInput
          label="Depart"
          placeholder="Ma position"
          value={origin}
          onChange={setOrigin}
        />

        <AddressAutocompleteInput
          label="Destination"
          placeholder="Ville ou adresse d'arrivee"
          value={destination}
          onChange={setDestination}
        />

        <Text style={styles.label}>Deviation max</Text>
        <View style={styles.sliderTrack}>
          {DEVIATION_OPTIONS.map((value) => (
            <TouchableOpacity
              key={value}
              style={[styles.sliderStep, value === deviationMaxMinutes && styles.sliderStepActive]}
              onPress={() => setDeviationMaxMinutes(value)}
            >
              <Text style={[styles.sliderStepText, value === deviationMaxMinutes && styles.sliderStepTextActive]}>
                {value} min
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Recevoir des opportunites pendant la conduite</Text>
            <Text style={styles.toggleHint}>Active les permissions notif + localisation arriere-plan.</Text>
          </View>
          <Switch value={opportunitiesEnabled} onValueChange={setOpportunitiesEnabled} trackColor={{ true: Colors.dark.primary }} />
        </View>

        <Text style={styles.permissionsText}>
          En demarrant, Colib peut utiliser votre localisation en arriere-plan pour detecter des colis compatibles. Vous pouvez arreter le trajet a tout moment.
        </Text>

        <TouchableOpacity
          style={[styles.button, (!canSubmit || isSubmitting) && styles.buttonDisabled]}
          disabled={!canSubmit || isSubmitting}
          onPress={handleLaunch}
        >
          {isSubmitting ? <ActivityIndicator color={Colors.dark.text} /> : <Text style={styles.buttonText}>Lancer dans Waze</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingTop: 58, paddingBottom: 40, gap: 10 },
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
    marginBottom: 6,
    backgroundColor: Colors.dark.surface,
  },
  backButtonText: { fontSize: 12, color: Colors.dark.textSecondary, fontFamily: Fonts.sansSemiBold },
  title: { fontSize: 24, color: Colors.dark.text, fontFamily: Fonts.displaySemiBold },
  subtitle: { marginTop: -3, marginBottom: 8, color: Colors.dark.textSecondary, fontSize: 14, lineHeight: 20, fontFamily: Fonts.sans },
  label: { marginTop: 8, marginBottom: 4, color: Colors.dark.textSecondary, fontSize: 14, fontFamily: Fonts.sansSemiBold },
  sliderTrack: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sliderStep: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sliderStepActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primaryLight,
  },
  sliderStepText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  sliderStepTextActive: {
    color: Colors.dark.text,
  },
  toggleRow: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleTitle: { color: Colors.dark.text, fontSize: 14, fontFamily: Fonts.sansSemiBold },
  toggleHint: { color: Colors.dark.textSecondary, marginTop: 2, fontSize: 12, fontFamily: Fonts.sans },
  permissionsText: {
    marginTop: 6,
    color: Colors.dark.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  button: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.primary,
  },
  buttonDisabled: {
    backgroundColor: "#475467",
  },
  buttonText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontFamily: Fonts.sansSemiBold,
  },
  loadingRow: {
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: Colors.dark.primary,
    fontFamily: Fonts.sansSemiBold,
  },
});
