import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/context/UserContext";
import { AddressAutocompleteInput } from "@/components/maps/AddressAutocompleteInput";
import type { GeocodedAddress } from "@/packages/shared/maps";
import { buildDayWindowTimestamps, TimeWindowInput } from "@/components/forms/TimeWindowInput";
import { Colors, Fonts } from "@/constants/theme";

const TOTAL_STEPS = 4;

export default function OfferScreen() {
  const { userId, userName, isLoggedIn } = useUser();
  const params = useLocalSearchParams<{ tripId?: string }>();
  const tripId = typeof params.tripId === "string" ? params.tripId : undefined;
  const isEditMode = Boolean(tripId);

  const createTrip = useMutation(api.trips.create);
  const updateTrip = useMutation(api.trips.update);
  const recomputeForTrip = useMutation(api.matches.recomputeForTrip);
  const tripToEdit = useQuery(api.trips.getById, tripId ? { tripId: tripId as any } : "skip");

  const [step, setStep] = useState(1);
  const [originAddress, setOriginAddress] = useState<GeocodedAddress | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<GeocodedAddress | null>(null);
  const [availableSpace, setAvailableSpace] = useState<"petit" | "moyen" | "grand">("moyen");
  const [maxWeightKg, setMaxWeightKg] = useState("20");
  const [maxVolumeDm3, setMaxVolumeDm3] = useState("60");
  const [basePrice, setBasePrice] = useState("15");
  const [tripDate, setTripDate] = useState("");
  const [maxDetourMinutes, setMaxDetourMinutes] = useState(20);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const resetForm = () => {
    setOriginAddress(null);
    setDestinationAddress(null);
    setAvailableSpace("moyen");
    setMaxWeightKg("20");
    setMaxVolumeDm3("60");
    setBasePrice("15");
    setTripDate("");
    setMaxDetourMinutes(20);
    setStep(1);
    setShowAdvanced(false);
  };

  const canEditTrip = useMemo(() => {
    if (!tripToEdit) return false;
    return tripToEdit.ownerVisitorId === userId;
  }, [tripToEdit, userId]);

  useEffect(() => {
    if (!tripToEdit || !canEditTrip) return;
    setOriginAddress(tripToEdit.originAddress as GeocodedAddress);
    setDestinationAddress(tripToEdit.destinationAddress as GeocodedAddress);
    setAvailableSpace(tripToEdit.availableSpace);
    setMaxWeightKg(String(tripToEdit.maxWeightKg));
    setMaxVolumeDm3(String(tripToEdit.maxVolumeDm3));
    setBasePrice(String(tripToEdit.price));
    setMaxDetourMinutes(tripToEdit.maxDetourMinutes);

    const start = new Date(tripToEdit.windowStartTs);
    const day = String(start.getDate()).padStart(2, "0");
    const month = String(start.getMonth() + 1).padStart(2, "0");
    const year = start.getFullYear();
    setTripDate(`${day}/${month}/${year}`);
  }, [tripToEdit, canEditTrip]);

  if (!isLoggedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Identifiez-vous pour proposer un trajet</Text>
      </View>
    );
  }

  if (isEditMode && tripToEdit === undefined) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Chargement de votre annonce...</Text>
      </View>
    );
  }

  if (isEditMode && tripToEdit && !canEditTrip) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Cette annonce ne vous appartient pas.</Text>
      </View>
    );
  }

  const validateStep = (value: number) => {
    if (value === 1 && (!originAddress || !destinationAddress)) {
      Alert.alert("Itineraire incomplet", "Selectionnez depart et arrivee.");
      return false;
    }
    if (value === 2 && !buildDayWindowTimestamps(tripDate)) {
      Alert.alert("Date invalide", "Renseignez une date valide.");
      return false;
    }
    return true;
  };

  const publishTrip = async () => {
    if (!originAddress || !destinationAddress) {
      Alert.alert("Adresses requises", "Selectionnez depart et arrivee.");
      return;
    }

    const timeWindow = buildDayWindowTimestamps(tripDate);
    if (!timeWindow) {
      Alert.alert("Date invalide", "Choisissez la date du trajet au format JJ/MM/AAAA.");
      return;
    }

    const price = Number(basePrice);
    const maxWeight = Number(maxWeightKg);
    const maxVolume = Number(maxVolumeDm3);
    if (!Number.isFinite(price) || !Number.isFinite(maxWeight) || !Number.isFinite(maxVolume)) {
      Alert.alert("Valeurs invalides", "Renseignez prix, poids max et volume max valides.");
      return;
    }

    try {
      const payload = {
        ownerVisitorId: userId,
        originAddress,
        destinationAddress,
        windowStartTs: timeWindow.windowStartTs,
        windowEndTs: timeWindow.windowEndTs,
        availableSpace,
        maxWeightKg: maxWeight,
        maxVolumeDm3: maxVolume,
        price,
        maxDetourMinutes,
        description: undefined,
        phone: undefined,
      };

      const currentTripId = isEditMode
        ? (tripId as any)
        : await createTrip({ ...payload, userName });

      if (isEditMode) {
        await updateTrip({ ...payload, tripId: tripId as any });
      }

      await recomputeForTrip({ tripId: currentTripId });
      if (isEditMode) {
        Alert.alert("Annonce mise a jour", "Votre annonce trajet a ete modifiee.");
        router.replace("/(tabs)/profile");
      } else {
        resetForm();
        Alert.alert("Trajet publie", "Les colis compatibles sont visibles dans l'onglet Activite.");
      }
    } catch {
      Alert.alert("Erreur", isEditMode ? "Impossible de modifier le trajet." : "Impossible de publier le trajet.");
    }
  };

  const progress = Math.round((step / TOTAL_STEPS) * 100);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={() => (step === 1 ? router.back() : setStep((prev) => prev - 1))}>
          <Ionicons name="arrow-back" size={16} color={Colors.dark.textSecondary} />
          <Text style={styles.backButtonText}>{step === 1 ? "Precedent" : "Etape precedente"}</Text>
        </TouchableOpacity>

        <Text style={styles.header}>{isEditMode ? "Modifier mon trajet" : "Publier un trajet"}</Text>

        <Text style={styles.progressLabel}>Etape {step}/{TOTAL_STEPS}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>

        {step === 1 ? (
          <>
            <Text style={styles.stepTitle}>Itineraire</Text>
            <AddressAutocompleteInput
              label="Adresse depart"
              placeholder="Saisissez puis choisissez"
              value={originAddress}
              onChange={setOriginAddress}
            />
            <AddressAutocompleteInput
              label="Adresse arrivee"
              placeholder="Saisissez puis choisissez"
              value={destinationAddress}
              onChange={setDestinationAddress}
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.stepTitle}>Quand</Text>
            <TimeWindowInput
              title="Date de votre trajet"
              subtitle="Le matching se fait sur la journee"
              dateValue={tripDate}
              onDateChange={setTripDate}
              slot="day"
              onSlotChange={() => {}}
              showSlots={false}
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.stepTitle}>Capacite</Text>
            <Text style={styles.label}>Espace disponible</Text>
            <View style={styles.row}>
              {(["petit", "moyen", "grand"] as const).map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, value === availableSpace && styles.chipActive]}
                  onPress={() => setAvailableSpace(value)}
                >
                  <Text style={[styles.chipText, value === availableSpace && styles.chipTextActive]}>
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvanced((prev) => !prev)}>
              <Text style={styles.advancedToggleText}>{showAdvanced ? "Masquer options avancees" : "Afficher options avancees"}</Text>
            </TouchableOpacity>

            {showAdvanced ? (
              <>
                <Text style={styles.label}>Deviation max conducteur (min)</Text>
                <View style={styles.row}>
                  {[10, 20, 30].map((minutes) => (
                    <TouchableOpacity
                      key={minutes}
                      style={[styles.chip, maxDetourMinutes === minutes && styles.chipActive]}
                      onPress={() => setMaxDetourMinutes(minutes)}
                    >
                      <Text style={[styles.chipText, maxDetourMinutes === minutes && styles.chipTextActive]}>
                        {minutes}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Poids max (kg)</Text>
                <TextInput value={maxWeightKg} onChangeText={setMaxWeightKg} style={styles.input} keyboardType="numeric" />

                <Text style={styles.label}>Volume max (dm3)</Text>
                <TextInput value={maxVolumeDm3} onChangeText={setMaxVolumeDm3} style={styles.input} keyboardType="numeric" />

                <Text style={styles.label}>Prix de base (EUR)</Text>
                <TextInput value={basePrice} onChangeText={setBasePrice} style={styles.input} keyboardType="numeric" />
              </>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Text style={styles.stepTitle}>Verification</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLine}>Itineraire: {originAddress?.label ?? "-"}{" -> "}{destinationAddress?.label ?? "-"}</Text>
              <Text style={styles.summaryLine}>Date: {tripDate || "-"}</Text>
              <Text style={styles.summaryLine}>Espace: {availableSpace}</Text>
              <Text style={styles.summaryLine}>Deviation max: {maxDetourMinutes} min</Text>
            </View>
          </>
        ) : null}

        {step < TOTAL_STEPS ? (
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              if (!validateStep(step)) return;
              setStep((prev) => prev + 1);
            }}
          >
            <Text style={styles.buttonText}>Continuer</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.button} onPress={() => void publishTrip()}>
            <Ionicons name="car" size={18} color={Colors.dark.text} />
            <Text style={styles.buttonText}>{isEditMode ? "Mettre a jour" : "Publier"}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { fontSize: 24, color: Colors.dark.text, marginBottom: 10, fontFamily: Fonts.displaySemiBold },
  progressLabel: { fontSize: 12, color: Colors.dark.textSecondary, fontFamily: Fonts.sansSemiBold },
  progressTrack: {
    marginTop: 6,
    marginBottom: 14,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.dark.border,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: Colors.dark.primary,
  },
  stepTitle: { fontSize: 16, color: Colors.dark.text, marginBottom: 10, fontFamily: Fonts.displaySemiBold },
  label: { marginTop: 10, marginBottom: 6, fontSize: 14, color: Colors.dark.textSecondary, fontFamily: Fonts.sansSemiBold },
  input: {
    backgroundColor: Colors.dark.surface,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    borderRadius: 999,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipActive: { backgroundColor: Colors.dark.primary, borderColor: Colors.dark.primary },
  chipText: { color: Colors.dark.textSecondary, fontFamily: Fonts.sansSemiBold },
  chipTextActive: { color: Colors.dark.text },
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
    marginBottom: 10,
    backgroundColor: Colors.dark.surface,
  },
  backButtonText: { fontSize: 12, color: Colors.dark.textSecondary, fontFamily: Fonts.sansSemiBold },
  advancedToggle: { marginTop: 10, alignSelf: "flex-start" },
  advancedToggleText: { color: Colors.dark.primary, fontSize: 13, fontFamily: Fonts.sansSemiBold },
  button: {
    marginTop: 20,
    backgroundColor: Colors.dark.primary,
    borderRadius: 10,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: { color: Colors.dark.text, fontSize: 15, fontFamily: Fonts.sansSemiBold },
  summaryCard: {
    borderRadius: 10,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    backgroundColor: Colors.dark.surface,
    padding: 12,
    gap: 6,
  },
  summaryLine: { fontSize: 13, color: Colors.dark.textSecondary, fontFamily: Fonts.sans },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.dark.background },
  title: { fontSize: 16, color: Colors.dark.text, textAlign: "center", paddingHorizontal: 24, fontFamily: Fonts.displaySemiBold },
});
