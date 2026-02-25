import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";

export default function PublishScreen() {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.container}>
      {router.canGoBack() ? (
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace("/(tabs)" as any)}>
          <Ionicons name="arrow-back" size={16} color={Colors.dark.textSecondary} />
          <Text style={styles.backButtonText}>Retour accueil</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.title}>Publier</Text>
      <Text style={styles.subtitle}>Choisissez un parcours selon votre besoin du moment.</Text>

      <TouchableOpacity style={styles.primaryButton} activeOpacity={0.9} onPress={() => setOpen(true)}>
        <Ionicons name="add-circle" size={18} color={Colors.dark.text} />
        <Text style={styles.primaryButtonText}>Nouvelle annonce</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.8} onPress={() => router.push("/(tabs)/send" as any)}>
        <Ionicons name="cube-outline" size={17} color={Colors.dark.primary} />
        <View style={styles.actionCopyWrap}>
          <Text style={styles.secondaryButtonText}>Envoyer un colis</Text>
          <Text style={styles.secondaryButtonSubtext}>Je cherche un transporteur pour expedier rapidement</Text>
        </View>
        <Text style={styles.actionEta}>~1 min</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.8} onPress={() => router.push("/(tabs)/offer" as any)}>
        <Ionicons name="car-outline" size={17} color={Colors.dark.primary} />
        <View style={styles.actionCopyWrap}>
          <Text style={styles.secondaryButtonText}>Proposer un trajet</Text>
          <Text style={styles.secondaryButtonSubtext}>J ai de la place dans mon vehicule pour transporter</Text>
        </View>
        <Text style={styles.actionEta}>~2 min</Text>
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Nouvelle annonce</Text>
            <Text style={styles.sheetSubtitle}>Une seule action a la fois.</Text>

            <TouchableOpacity
              style={styles.sheetAction}
              activeOpacity={0.9}
              onPress={() => {
                setOpen(false);
                router.push("/(tabs)/send" as any);
              }}
            >
              <Ionicons name="cube-outline" size={18} color={Colors.dark.text} />
              <View style={styles.actionCopyWrap}>
                <Text style={styles.sheetActionText}>Envoyer un colis</Text>
                <Text style={styles.sheetActionSubtext}>Besoin d expedier un colis</Text>
              </View>
              <Text style={styles.actionEta}>~1 min</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.dark.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetAction}
              activeOpacity={0.9}
              onPress={() => {
                setOpen(false);
                router.push("/(tabs)/offer" as any);
              }}
            >
              <Ionicons name="car-outline" size={18} color={Colors.dark.text} />
              <View style={styles.actionCopyWrap}>
                <Text style={styles.sheetActionText}>Proposer un trajet</Text>
                <Text style={styles.sheetActionSubtext}>Publier votre itineraire</Text>
              </View>
              <Text style={styles.actionEta}>~2 min</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.dark.textSecondary} />
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 20,
    paddingTop: 72,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Fonts.displaySemiBold,
  },
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
  subtitle: {
    marginTop: 6,
    marginBottom: 20,
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.sans,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 13,
    backgroundColor: Colors.dark.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontFamily: Fonts.sansSemiBold,
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  actionCopyWrap: {
    flex: 1,
  },
  secondaryButtonText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  secondaryButtonSubtext: {
    marginTop: 2,
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  actionEta: {
    color: Colors.dark.warning,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(8, 12, 16, 0.64)",
  },
  sheet: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingBottom: 28,
    paddingTop: 10,
    gap: 10,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.dark.border,
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Fonts.displaySemiBold,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 2,
    fontFamily: Fonts.sans,
  },
  sheetAction: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingVertical: 13,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sheetActionText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
    flex: 1,
  },
  sheetActionSubtext: {
    marginTop: 2,
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
});
