import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/context/UserContext";
import { Ionicons } from "@expo/vector-icons";

const SIZE_OPTIONS = [
  { value: "petit" as const, label: "Petit", desc: "< 5 kg" },
  { value: "moyen" as const, label: "Moyen", desc: "5-15 kg" },
  { value: "grand" as const, label: "Grand", desc: "> 15 kg" },
];

export default function SendScreen() {
  const { userId, userName, isLoggedIn } = useUser();
  const createParcel = useMutation(api.parcels.create);

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [size, setSize] = useState<"petit" | "moyen" | "grand">("petit");
  const [weight, setWeight] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");

  if (!isLoggedIn) {
    return (
      <View style={styles.authContainer}>
        <Ionicons name="person-circle-outline" size={64} color="#94A3B8" />
        <Text style={styles.authTitle}>Identifiez-vous</Text>
        <Text style={styles.authText}>
          Rendez-vous dans l'onglet Profil pour entrer votre nom avant de
          publier une annonce.
        </Text>
      </View>
    );
  }

  const handleSubmit = async () => {
    if (!origin.trim() || !destination.trim() || !description.trim()) {
      Alert.alert("Champs requis", "Veuillez remplir tous les champs obligatoires.");
      return;
    }
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) {
      Alert.alert("Poids invalide", "Veuillez entrer un poids valide.");
      return;
    }

    try {
      await createParcel({
        userId,
        userName,
        origin: origin.trim(),
        destination: destination.trim(),
        size,
        weight: weightNum,
        description: description.trim(),
        phone: phone.trim() || undefined,
      });
      Alert.alert("Publie !", "Votre demande de colis a ete publiee.");
      setOrigin("");
      setDestination("");
      setSize("petit");
      setWeight("");
      setDescription("");
      setPhone("");
    } catch {
      Alert.alert("Erreur", "Une erreur est survenue. Reessayez.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Envoyer un colis</Text>
          <Text style={styles.headerSubtitle}>
            Trouvez quelqu'un pour transporter votre colis
          </Text>
        </View>

        <Text style={styles.label}>Ville de depart *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Paris"
          placeholderTextColor="#94A3B8"
          value={origin}
          onChangeText={setOrigin}
        />

        <Text style={styles.label}>Ville d'arrivee *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Lyon"
          placeholderTextColor="#94A3B8"
          value={destination}
          onChangeText={setDestination}
        />

        <Text style={styles.label}>Taille du colis *</Text>
        <View style={styles.segmentContainer}>
          {SIZE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.segmentButton,
                size === opt.value && styles.segmentButtonActive,
              ]}
              onPress={() => setSize(opt.value)}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  size === opt.value && styles.segmentLabelActive,
                ]}
              >
                {opt.label}
              </Text>
              <Text
                style={[
                  styles.segmentDesc,
                  size === opt.value && styles.segmentDescActive,
                ]}
              >
                {opt.desc}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Poids (kg) *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 3"
          placeholderTextColor="#94A3B8"
          keyboardType="numeric"
          value={weight}
          onChangeText={setWeight}
        />

        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Decrivez votre colis..."
          placeholderTextColor="#94A3B8"
          multiline
          numberOfLines={3}
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.label}>Telephone (optionnel)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 06 12 34 56 78"
          placeholderTextColor="#94A3B8"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <Ionicons name="cube" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Publier l'annonce</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1E293B",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
  },
  authContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#F8FAFC",
  },
  authTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1E293B",
    marginTop: 16,
    marginBottom: 8,
  },
  authText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1E293B",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  segmentContainer: {
    flexDirection: "row",
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 10,
    alignItems: "center",
  },
  segmentButtonActive: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  segmentLabelActive: {
    color: "#FFFFFF",
  },
  segmentDesc: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  segmentDescActive: {
    color: "#C7D2FE",
  },
  button: {
    backgroundColor: "#6366F1",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
