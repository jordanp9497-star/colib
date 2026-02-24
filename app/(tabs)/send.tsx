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

export default function SendScreen() {
  const { userId, userName, isLoggedIn } = useUser();
  const params = useLocalSearchParams<{ parcelId?: string }>();
  const parcelId = typeof params.parcelId === "string" ? params.parcelId : undefined;
  const isEditMode = Boolean(parcelId);

  const createParcel = useMutation(api.parcels.create);
  const updateParcel = useMutation(api.parcels.update);
  const recomputeMatches = useMutation(api.matches.recomputeForParcel);
  const parcelToEdit = useQuery(api.parcels.getById, parcelId ? { parcelId: parcelId as any } : "skip");

  const [originAddress, setOriginAddress] = useState<GeocodedAddress | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<GeocodedAddress | null>(null);
  const [size, setSize] = useState<"petit" | "moyen" | "grand">("petit");
  const [weight, setWeight] = useState("2");
  const [volumeDm3, setVolumeDm3] = useState("12");
  const [description, setDescription] = useState("");
  const [shippingDate, setShippingDate] = useState("");
  const [shippingSlot, setShippingSlot] = useState<SlotKey>("afternoon");

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

      const matching = await recomputeMatches({ parcelId: parcelRef.parcelId });
      if (!matching.count) {
        Alert.alert(
          isEditMode ? "Annonce mise a jour" : "Colis publie",
          isEditMode
            ? "Aucun match immediat apres modification, mais votre annonce est bien active."
            : "Aucun match immediat, mais votre colis est bien publie et pourra etre recupere plus tard."
        );
      }
      if (isEditMode) {
        Alert.alert("Annonce mise a jour", "Votre annonce colis a ete modifiee.");
        router.replace("/(tabs)/profile");
      } else {
        router.push(`/match/${parcelRef.parcelId}` as any);
      }
    } catch {
      Alert.alert("Erreur", isEditMode ? "Modification impossible, reessayez." : "Publication impossible, reessayez.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} style={styles.container}>
        <Text style={styles.header}>{isEditMode ? "Modifier mon colis" : "Publier un colis"}</Text>

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

        <Text style={styles.label}>Volume (dm3)</Text>
        <TextInput value={volumeDm3} onChangeText={setVolumeDm3} style={styles.input} keyboardType="numeric" />

        <TimeWindowInput
          title="Date de recuperation souhaitee"
          subtitle="Ajoutez un creneau prefere (matin, apres-midi ou soiree)"
          dateValue={shippingDate}
          onDateChange={setShippingDate}
          slot={shippingSlot}
          onSlotChange={setShippingSlot}
          slotOptions={["morning", "afternoon", "evening"]}
          slotMode="dropdown"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Optionnel: infos utiles sur le colis"
          placeholderTextColor="#94A3B8"
          multiline
        />

        <TouchableOpacity style={styles.button} onPress={handlePublish}>
          <Ionicons name="cube" size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>{isEditMode ? "Mettre a jour votre annonce" : "Publier et voir les matches"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { fontSize: 24, color: "#0F172A", fontWeight: "700", marginBottom: 12 },
  label: { fontSize: 14, color: "#334155", fontWeight: "600", marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 8 },
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 16, fontWeight: "700", color: "#0F172A", textAlign: "center" },
});
