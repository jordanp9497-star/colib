import { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";

export default function SettingsScreen() {
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const openSystemSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert("Impossible", "Ouverture des reglages systeme indisponible sur cet appareil.");
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      scrollEventThrottle={16}
    >
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as any))}
      >
        <Ionicons name="arrow-back" size={16} color={Colors.dark.textSecondary} />
        <Text style={styles.backButtonText}>Retour</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Reglages</Text>
      <Text style={styles.subtitle}>Accessibilite, notifications, geolocalisation et preferences app.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Accessibilite</Text>
        <RowSwitch
          label="Texte plus grand"
          hint="Ameliore la lisibilite des contenus"
          value={largeText}
          onValueChange={setLargeText}
        />
        <RowSwitch
          label="Contraste renforce"
          hint="Couleurs plus franches pour les elements"
          value={highContrast}
          onValueChange={setHighContrast}
        />
        <RowSwitch
          label="Reduire les animations"
          hint="Moins de mouvement dans les transitions"
          value={reduceMotion}
          onValueChange={setReduceMotion}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Permissions systeme</Text>
        <TouchableOpacity style={styles.actionButton} onPress={openSystemSettings}>
          <Ionicons name="notifications-outline" size={18} color={Colors.dark.primary} />
          <Text style={styles.actionText}>Configurer les notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={openSystemSettings}>
          <Ionicons name="navigate-outline" size={18} color={Colors.dark.primary} />
          <Text style={styles.actionText}>Configurer la geolocalisation</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={openSystemSettings}>
          <Ionicons name="shield-checkmark-outline" size={18} color={Colors.dark.primary} />
          <Text style={styles.actionText}>Confidentialite et securite</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function RowSwitch({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.switchLabel}>{label}</Text>
        <Text style={styles.switchHint}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: Colors.dark.primary }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 16, paddingTop: 56, paddingBottom: 24, gap: 12 },
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
    marginBottom: 2,
    backgroundColor: Colors.dark.surface,
  },
  backButtonText: { fontSize: 12, color: Colors.dark.textSecondary, fontFamily: Fonts.sansSemiBold },
  title: { fontSize: 24, color: Colors.dark.text, fontFamily: Fonts.displaySemiBold },
  subtitle: { marginTop: 2, marginBottom: 2, fontSize: 13, color: Colors.dark.textSecondary, fontFamily: Fonts.sans },
  card: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  sectionTitle: { fontSize: 14, color: Colors.dark.text, marginBottom: 2, fontFamily: Fonts.sansSemiBold },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  switchLabel: { fontSize: 14, color: Colors.dark.text, fontFamily: Fonts.sansSemiBold },
  switchHint: { marginTop: 2, fontSize: 12, color: Colors.dark.textSecondary, fontFamily: Fonts.sans },
  actionButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionText: { color: Colors.dark.text, fontSize: 13, fontFamily: Fonts.sansSemiBold },
});
