import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";
import { useUser } from "@/context/UserContext";

export default function PublishScreen() {
  const { isLoggedIn } = useUser();

  if (!isLoggedIn) {
    return (
      <View style={styles.containerBlocked}>
        <Ionicons name="lock-closed-outline" size={22} color={Colors.dark.textSecondary} />
        <Text style={styles.title}>Connectez-vous pour publier</Text>
        <Text style={styles.subtitle}>{"L'envoi de colis et la publication de trajets sont disponibles apres connexion."}</Text>
        <TouchableOpacity style={styles.blockedCta} onPress={() => router.push("/(tabs)/profile" as any)}>
          <Text style={styles.blockedCtaText}>Aller a la connexion</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {router.canGoBack() ? (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as any))}
        >
          <Ionicons name="arrow-back" size={16} color={Colors.dark.textSecondary} />
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.title}>Publier</Text>
      <Text style={styles.subtitle}>Choisissez un parcours selon votre besoin du moment.</Text>

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
    </View>
  );
}

const styles = StyleSheet.create({
  containerBlocked: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
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
    textAlign: "center",
  },
  blockedCta: {
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  blockedCtaText: {
    color: Colors.dark.text,
    fontSize: 13,
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
});
