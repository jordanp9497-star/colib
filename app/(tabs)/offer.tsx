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

export default function OfferScreen() {
  const { userId, userName, isLoggedIn } = useUser();
  const params = useLocalSearchParams<{ tripId?: string }>();
  const tripId = typeof params.tripId === "string" ? params.tripId : undefined;
  const isEditMode = Boolean(tripId);

  const createTrip = useMutation(api.trips.create);
  const updateTrip = useMutation(api.trips.update);
  const recomputeForTrip = useMutation(api.matches.recomputeForTrip);
  const tripToEdit = useQuery(api.trips.getById, tripId ? { tripId: tripId as any } : "skip");

  const [originAddress, setOriginAddress] = useState<GeocodedAddress | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<GeocodedAddress | null>(null);
  const [availableSpace, setAvailableSpace] = useState<"petit" | "moyen" | "grand">("moyen");
  const [maxWeightKg, setMaxWeightKg] = useState("20");
  const [maxVolumeDm3, setMaxVolumeDm3] = useState("60");
  const [basePrice, setBasePrice] = useState("15");
  const [tripDate, setTripDate] = useState("");
  const [maxDetourMinutes, setMaxDetourMinutes] = useState(20);

  const resetForm = () => {
    setOriginAddress(null);
    setDestinationAddress(null);
    setAvailableSpace("moyen");
    setMaxWeightKg("20");
    setMaxVolumeDm3("60");
    setBasePrice("15");
    setTripDate("");
    setMaxDetourMinutes(20);
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

  const publishTrip = async () => {
    if (!originAddress || !destinationAddress) {
      Alert.alert("Adresses requises", "Selectionnez depart et arrivee.");
      return;
    }

    const timeWindow = buildDayWindowTimestamps(tripDate);
    if (!timeWindow) {
      Alert.alert(
        "Date invalide",
        "Choisissez la date du trajet au format JJ/MM/AAAA."
      );
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
        Alert.alert("Trajet publie", "Les colis compatibles sont visibles dans l'onglet Carte.");
      }
    } catch {
      Alert.alert("Erreur", isEditMode ? "Impossible de modifier le trajet." : "Impossible de publier le trajet.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {isEditMode ? (
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color="#334155" />
            <Text style={styles.backButtonText}>Precedent</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.header}>{isEditMode ? "Modifier mon trajet" : "Publier un trajet"}</Text>

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

        <TimeWindowInput
          title="Date de votre trajet"
          subtitle="Le matching se fait sur la journee entiere de ce trajet"
          dateValue={tripDate}
          onDateChange={setTripDate}
          slot="day"
          onSlotChange={() => {}}
          showSlots={false}
        />

        <TouchableOpacity style={styles.button} onPress={publishTrip}>
          <Ionicons name="car" size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>{isEditMode ? "Mettre a jour votre annonce" : "Publier et matcher les colis"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { fontSize: 24, color: "#0F172A", fontWeight: "700", marginBottom: 14 },
  label: { marginTop: 10, marginBottom: 6, fontSize: 14, fontWeight: "600", color: "#334155" },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    borderRadius: 999,
    borderColor: "#CBD5E1",
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipActive: { backgroundColor: "#4F46E5", borderColor: "#4F46E5" },
  chipText: { color: "#334155", fontWeight: "600" },
  chipTextActive: { color: "#FFFFFF" },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  backButtonText: { fontSize: 12, fontWeight: "700", color: "#334155" },
  button: {
    marginTop: 20,
    backgroundColor: "#4F46E5",
    borderRadius: 10,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" },
  title: { fontSize: 16, fontWeight: "700", color: "#0F172A", textAlign: "center", paddingHorizontal: 24 },
});
