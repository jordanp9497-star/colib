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
import { buildWindowTimestamps, TimeWindowInput, type SlotKey } from "@/components/forms/TimeWindowInput";
import { Colors, Fonts } from "@/constants/theme";

const TOTAL_STEPS = 4;

export default function SendScreen() {
  const { userId, userName, isLoggedIn } = useUser();
  const params = useLocalSearchParams<{ parcelId?: string }>();
  const parcelId = typeof params.parcelId === "string" ? params.parcelId : undefined;
  const isEditMode = Boolean(parcelId);

  const createParcel = useMutation(api.parcels.create);
  const updateParcel = useMutation(api.parcels.update);
  const recomputeMatches = useMutation(api.matches.recomputeForParcel);
  const parcelToEdit = useQuery(api.parcels.getById, parcelId ? { parcelId: parcelId as any } : "skip");

  const [step, setStep] = useState(1);
  const [originAddress, setOriginAddress] = useState<GeocodedAddress | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<GeocodedAddress | null>(null);
  const [size, setSize] = useState<"petit" | "moyen" | "grand">("petit");
  const [weight, setWeight] = useState("2");
  const [volumeDm3, setVolumeDm3] = useState("12");
  const [description, setDescription] = useState("");
  const [shippingDate, setShippingDate] = useState("");
  const [shippingSlot, setShippingSlot] = useState<SlotKey>("afternoon");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const resetForm = () => {
    setOriginAddress(null);
    setDestinationAddress(null);
    setSize("petit");
    setWeight("2");
    setVolumeDm3("12");
    setDescription("");
    setShippingDate("");
    setShippingSlot("afternoon");
    setStep(1);
    setShowAdvanced(false);
  };

  const canEditParcel = useMemo(() => {
    if (!parcelToEdit) return false;
    return parcelToEdit.ownerVisitorId === userId;
  }, [parcelToEdit, userId]);

  useEffect(() => {
    if (!parcelToEdit || !canEditParcel) return;
    setOriginAddress(parcelToEdit.originAddress as GeocodedAddress);
    setDestinationAddress(parcelToEdit.destinationAddress as GeocodedAddress);
    setSize(parcelToEdit.size);
    setWeight(String(parcelToEdit.weight));
    setVolumeDm3(String(parcelToEdit.volumeDm3));
    setDescription(parcelToEdit.description);

    const start = new Date(parcelToEdit.preferredWindowStartTs);
    const day = String(start.getDate()).padStart(2, "0");
    const month = String(start.getMonth() + 1).padStart(2, "0");
    const year = start.getFullYear();
    setShippingDate(`${day}/${month}/${year}`);

    const hour = start.getHours();
    if (hour < 12) setShippingSlot("morning");
    else if (hour < 17) setShippingSlot("afternoon");
    else setShippingSlot("evening");
  }, [parcelToEdit, canEditParcel]);

  if (!isLoggedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Identifiez-vous pour publier un colis</Text>
      </View>
    );
  }

  if (isEditMode && parcelToEdit === undefined) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Chargement de votre annonce...</Text>
      </View>
    );
  }

  if (isEditMode && parcelToEdit && !canEditParcel) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Cette annonce ne vous appartient pas.</Text>
      </View>
    );
  }

  const validateStep = (value: number) => {
    if (value === 1 && (!originAddress || !destinationAddress)) {
      Alert.alert("Itineraire incomplet", "Ajoutez depart et arrivee.");
      return false;
    }
    if (value === 2 && !buildWindowTimestamps(shippingDate, shippingSlot)) {
      Alert.alert("Date invalide", "Choisissez une date valide et un creneau.");
      return false;
    }
    if (value === 3) {
      const weightNum = Number(weight);
      if (!Number.isFinite(weightNum) || weightNum <= 0) {
        Alert.alert("Poids invalide", "Renseignez un poids valide.");
        return false;
      }
    }
    return true;
  };

  const handlePublish = async () => {
    if (!originAddress || !destinationAddress) {
      Alert.alert("Champs requis", "Selectionnez l adresse de depart et l adresse d arrivee.");
      return;
    }

    const weightNum = Number(weight);
    const volumeNum = Number(volumeDm3);
    if (!Number.isFinite(weightNum) || weightNum <= 0 || !Number.isFinite(volumeNum) || volumeNum <= 0) {
      Alert.alert("Dimensions invalides", "Renseignez un poids et un volume valides.");
      return;
    }

    const timeWindow = buildWindowTimestamps(shippingDate, shippingSlot);
    if (!timeWindow) {
      Alert.alert(
        "Date invalide",
        "Choisissez une date au format JJ/MM/AAAA puis un creneau (matin/apres-midi/soiree)."
      );
      return;
    }

    try {
      const payload = {
        ownerVisitorId: userId,
        originAddress,
        destinationAddress,
        size,
        weight: weightNum,
        volumeDm3: volumeNum,
        description: description.trim() || "Colis sans description",
        fragile: false,
        urgencyLevel: "normal" as const,
        insuranceValue: undefined,
        preferredWindowStartTs: timeWindow.windowStartTs,
        preferredWindowEndTs: timeWindow.windowEndTs,
        phone: undefined,
      };

      const parcelRef = isEditMode
        ? { parcelId: parcelId as any }
        : await createParcel({ ...payload, userName });

      if (isEditMode) {
        await updateParcel({ ...payload, parcelId: parcelId as any });
      }

      await recomputeMatches({ parcelId: parcelRef.parcelId });
      if (isEditMode) {
        Alert.alert("Annonce mise a jour", "Votre annonce colis a ete modifiee.");
        router.replace("/(tabs)/profile");
      } else {
        resetForm();
        router.push(`/match/${parcelRef.parcelId}` as any);
      }
    } catch {
      Alert.alert("Erreur", isEditMode ? "Modification impossible, reessayez." : "Publication impossible, reessayez.");
    }
  };

  const progress = Math.round((step / TOTAL_STEPS) * 100);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (step === 1 ? router.replace("/(tabs)" as any) : setStep((prev) => prev - 1))}
        >
          <Ionicons name="arrow-back" size={16} color={Colors.dark.textSecondary} />
          <Text style={styles.backButtonText}>{step === 1 ? "Retour accueil" : "Etape precedente"}</Text>
        </TouchableOpacity>

        <Text style={styles.header}>{isEditMode ? "Modifier mon colis" : "Publier un colis"}</Text>

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
              title="Date de recuperation souhaitee"
              subtitle="Ajoutez un creneau prefere"
              dateValue={shippingDate}
              onDateChange={setShippingDate}
              slot={shippingSlot}
              onSlotChange={setShippingSlot}
              slotOptions={["morning", "afternoon", "evening"]}
              slotMode="dropdown"
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.stepTitle}>Taille et poids</Text>
            <Text style={styles.label}>Taille</Text>
            <View style={styles.row}>
              {(["petit", "moyen", "grand"] as const).map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setSize(value)}
                  style={[styles.chip, size === value && styles.chipActive]}
                >
                  <Text style={[styles.chipText, size === value && styles.chipTextActive]}>{value}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Poids (kg)</Text>
            <TextInput value={weight} onChangeText={setWeight} style={styles.input} keyboardType="numeric" />

            <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvanced((prev) => !prev)}>
              <Text style={styles.advancedToggleText}>{showAdvanced ? "Masquer options avancees" : "Afficher options avancees"}</Text>
            </TouchableOpacity>

            {showAdvanced ? (
              <>
                <Text style={styles.label}>Volume (dm3)</Text>
                <TextInput value={volumeDm3} onChangeText={setVolumeDm3} style={styles.input} keyboardType="numeric" />

                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Optionnel"
                  placeholderTextColor="#94A3B8"
                  multiline
                />
              </>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Text style={styles.stepTitle}>Verification</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLine}>Itineraire: {originAddress?.label ?? "-"}{" -> "}{destinationAddress?.label ?? "-"}</Text>
              <Text style={styles.summaryLine}>Date: {shippingDate || "-"}</Text>
              <Text style={styles.summaryLine}>Creneau: {shippingSlot}</Text>
              <Text style={styles.summaryLine}>Taille: {size}</Text>
              <Text style={styles.summaryLine}>Poids: {weight} kg</Text>
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
          <TouchableOpacity style={styles.button} onPress={() => void handlePublish()}>
            <Ionicons name="cube" size={18} color={Colors.dark.text} />
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
  label: { fontSize: 14, color: Colors.dark.textSecondary, marginBottom: 6, marginTop: 10, fontFamily: Fonts.sansSemiBold },
  input: {
    backgroundColor: Colors.dark.surface,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 8 },
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 16, color: Colors.dark.text, textAlign: "center", fontFamily: Fonts.displaySemiBold },
});
