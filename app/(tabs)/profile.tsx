import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
  AccessibilityInfo,
} from "react-native";
import { Image } from "expo-image";
import { useQuery, useMutation } from "convex/react";
import { router } from "expo-router";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/context/UserContext";
import { Ionicons } from "@expo/vector-icons";
import TripCard from "@/components/TripCard";
import ParcelCard from "@/components/ParcelCard";
import StarRating from "@/components/profile/StarRating";
import VerificationBadge from "@/components/profile/VerificationBadge";
import { pickImage, takePhoto, uploadToConvex } from "@/utils/uploadImage";
import { SwipeActionRow } from "@/components/gestures/SwipeActionRow";
import { Colors, Fonts } from "@/constants/theme";

export default function ProfileScreen() {
  const { userId, isLoggedIn, isLoading, register, user } = useUser();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  if (!isLoggedIn) {
    return <RegistrationFlow userId={userId} register={register} />;
  }

  return <LoggedInProfile userId={userId} user={user!} />;
}

// ─── INSCRIPTION ────────────────────────────────────────

function RegistrationFlow({
  userId,
  register,
}: {
  userId: string;
  register: (name: string, phone?: string) => Promise<void>;
}) {
  const [step, setStep] = useState<"name" | "email">("name");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  // Email verification
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const requestCode = useMutation(api.emailVerification.requestCode);
  const verifyCode = useMutation(api.emailVerification.verifyCode);

  const handleNameSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Nom requis", "Veuillez entrer votre nom.");
      return;
    }
    await register(name, phone || undefined);
    setStep("email");
  };

  const handleSendCode = async () => {
    if (!email.trim() || !email.includes("@")) {
      Alert.alert("Email invalide", "Veuillez entrer un email valide.");
      return;
    }
    try {
      const result = await requestCode({ visitorId: userId, email: email.trim() });
      setCodeSent(true);
      Alert.alert(
        "Code envoye (BETA)",
        `Votre code de verification est : ${result.code}\n\nEn production, ce code serait envoye par email.`
      );
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer le code.");
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      Alert.alert("Code incomplet", "Entrez le code a 6 chiffres.");
      return;
    }
    setVerifying(true);
    try {
      const result = await verifyCode({
        visitorId: userId,
        email: email.trim(),
        code: verificationCode,
      });
      if (result.success) {
        Alert.alert("Email verifie", "Votre email a ete verifie avec succes !");
      } else {
        Alert.alert("Erreur", result.error || "Code invalide.");
      }
    } catch {
      Alert.alert("Erreur", "Verification echouee.");
    } finally {
      setVerifying(false);
    }
  };

  if (step === "name") {
    return (
      <KeyboardAvoidingView
        style={styles.authContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person" size={48} color="#94A3B8" />
        </View>
        <Text style={styles.authTitle}>Bienvenue sur Colib</Text>
        <Text style={styles.authText}>
          Creez votre profil pour commencer a publier des trajets et envoyer des
          colis.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Votre nom"
          placeholderTextColor={Colors.dark.textSecondary}
          value={name}
          onChangeText={setName}
          autoFocus
        />
        <TextInput
          style={styles.input}
          placeholder="Telephone (optionnel)"
          placeholderTextColor={Colors.dark.textSecondary}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TouchableOpacity style={styles.primaryButton} onPress={handleNameSubmit}>
          <Text style={styles.primaryButtonText}>Suivant</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  // Etape email
  return (
    <KeyboardAvoidingView
      style={styles.authContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.avatarPlaceholder}>
          <Ionicons name="mail" size={48} color={Colors.dark.primary} />
      </View>
      <Text style={styles.authTitle}>Verifiez votre email</Text>
      <Text style={styles.authText}>
        Ajoutez votre email pour securiser votre compte et recevoir des
        notifications.
      </Text>

      {!codeSent ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="votre@email.com"
            placeholderTextColor={Colors.dark.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoFocus
          />
          <TouchableOpacity style={styles.primaryButton} onPress={handleSendCode}>
            <Text style={styles.primaryButtonText}>Envoyer le code</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.codeLabel}>
            Code envoye a {email}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Code a 6 chiffres"
            placeholderTextColor={Colors.dark.textSecondary}
            value={verificationCode}
            onChangeText={(t) => setVerificationCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.primaryButton, verifying && styles.disabledButton]}
            onPress={handleVerifyCode}
            disabled={verifying}
          >
            {verifying ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Verifier</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.resendButton}
              onPress={() => {
                setCodeSent(false);
                setVerificationCode("");
              }}
          >
            <Text style={styles.linkText}>Renvoyer le code</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.skipButton}>
        {/* Skip = on ne fait rien, le user est deja cree */}
        <Text style={styles.linkText}>Passer cette etape</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

// ─── PROFIL CONNECTE ────────────────────────────────────

function LoggedInProfile({
  userId,
  user,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useUser>["user"]>;
}) {
  const myTrips = useQuery(api.trips.getByUser, { userId });
  const myParcels = useQuery(api.parcels.getByUser, { userId });
  const reviews = useQuery(api.reviews.getForUser, { revieweeId: userId });
  const compliance = useQuery(api.compliance.getCarrierCompliance, { carrierVisitorId: userId });
  const { logout } = useUser();

  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const saveProfilePhoto = useMutation(api.users.saveProfilePhoto);
  const saveIdentityDocs = useMutation(api.users.saveIdentityDocuments);
  const submitCarrierDocuments = useMutation(api.compliance.submitCarrierDocuments);
  const removeTrip = useMutation(api.trips.remove);
  const removeParcel = useMutation(api.parcels.remove);

  const [uploading, setUploading] = useState(false);
  const [uploadingId, setUploadingId] = useState(false);
  const [uploadingCg, setUploadingCg] = useState(false);
  const [idCardExpiryInput, setIdCardExpiryInput] = useState("");
  const [carteGriseExpiryInput, setCarteGriseExpiryInput] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [submittingCompliance, setSubmittingCompliance] = useState(false);

  // Email verification (si pas encore fait)
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [openSections, setOpenSections] = useState({
    identity: true,
    verification: true,
    trips: false,
    parcels: false,
  });
  const [inlineFeedback, setInlineFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  const requestCode = useMutation(api.emailVerification.requestCode);
  const verifyCode = useMutation(api.emailVerification.verifyCode);

  const isListLoading = myTrips === undefined || myParcels === undefined;
  const completionChecks = [
    Boolean(user.name.trim()),
    Boolean(user.phone?.trim()),
    Boolean(user.emailVerified),
    Boolean(user.profilePhotoUrl),
    Boolean(user.identityVerified === "verified"),
  ];
  const completionPercent = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const toggleSection = (section: keyof typeof openSections) => {
    if (!reduceMotion) {
      if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
      }
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handlePickProfilePhoto = async () => {
    Alert.alert("Photo de profil", "Comment voulez-vous ajouter votre photo ?", [
      {
        text: "Galerie",
        onPress: async () => {
          const uri = await pickImage([1, 1]);
          if (uri) await uploadProfilePhoto(uri);
        },
      },
      {
        text: "Camera",
        onPress: async () => {
          const uri = await takePhoto([1, 1]);
          if (uri) await uploadProfilePhoto(uri);
        },
      },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  const uploadProfilePhoto = async (uri: string) => {
    setUploading(true);
    setInlineFeedback(null);
    try {
      const storageId = await uploadToConvex(uri, generateUploadUrl);
      await saveProfilePhoto({ visitorId: userId, storageId: storageId as any });
      setInlineFeedback({ type: "success", message: "Photo de profil mise a jour." });
    } catch {
      setInlineFeedback({ type: "error", message: "Impossible de sauvegarder la photo." });
    } finally {
      setUploading(false);
    }
  };

  const handleUploadIdCard = async () => {
    Alert.alert("Piece d'identite", "Comment voulez-vous ajouter votre document ?", [
      {
        text: "Galerie",
        onPress: async () => {
          const uri = await pickImage([16, 10]);
          if (uri) await uploadIdCard(uri);
        },
      },
      {
        text: "Camera",
        onPress: async () => {
          const uri = await takePhoto([16, 10]);
          if (uri) await uploadIdCard(uri);
        },
      },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  const uploadIdCard = async (uri: string) => {
    setUploadingId(true);
    setInlineFeedback(null);
    try {
      const storageId = await uploadToConvex(uri, generateUploadUrl);
      await saveIdentityDocs({
        visitorId: userId,
        idCardPhotoId: storageId as any,
        carteGrisePhotoId: user.carteGrisePhotoId as any,
      });
      setInlineFeedback({ type: "success", message: "Piece d'identite envoyee." });
    } catch {
      setInlineFeedback({ type: "error", message: "Impossible d'envoyer la piece d'identite." });
    } finally {
      setUploadingId(false);
    }
  };

  const handleUploadCarteGrise = async () => {
    Alert.alert("Carte grise", "Comment voulez-vous ajouter votre document ?", [
      {
        text: "Galerie",
        onPress: async () => {
          const uri = await pickImage([16, 10]);
          if (uri) await uploadCarteGrise(uri);
        },
      },
      {
        text: "Camera",
        onPress: async () => {
          const uri = await takePhoto([16, 10]);
          if (uri) await uploadCarteGrise(uri);
        },
      },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  const uploadCarteGrise = async (uri: string) => {
    setUploadingCg(true);
    setInlineFeedback(null);
    try {
      const storageId = await uploadToConvex(uri, generateUploadUrl);
      if (!user.idCardPhotoId) {
        setInlineFeedback({
          type: "info",
          message: "Envoyez d'abord votre piece d'identite avant la carte grise.",
        });
        return;
      }
      await saveIdentityDocs({
        visitorId: userId,
        idCardPhotoId: user.idCardPhotoId as any,
        carteGrisePhotoId: storageId as any,
      });
      setInlineFeedback({ type: "success", message: "Carte grise envoyee." });
    } catch {
      setInlineFeedback({ type: "error", message: "Impossible d'envoyer la carte grise." });
    } finally {
      setUploadingCg(false);
    }
  };

  const parseExpiryInputToTimestamp = (value: string) => {
    const normalized = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
    const ts = Date.parse(`${normalized}T23:59:59`);
    if (Number.isNaN(ts)) return null;
    return ts;
  };

  const handleSubmitCompliance = async () => {
    if (!user.idCardPhotoId || !user.carteGrisePhotoId) {
      setInlineFeedback({ type: "info", message: "Ajoutez les deux documents avant envoi du dossier." });
      return;
    }

    const idCardExpiresAt = parseExpiryInputToTimestamp(idCardExpiryInput);
    const carteGriseExpiresAt = parseExpiryInputToTimestamp(carteGriseExpiryInput);
    if (!idCardExpiresAt || !carteGriseExpiresAt) {
      setInlineFeedback({ type: "error", message: "Utilisez le format YYYY-MM-DD pour les deux dates." });
      return;
    }

    const plate = vehiclePlate.trim().toUpperCase();
    if (plate.length < 4) {
      setInlineFeedback({ type: "error", message: "Entrez un numero de plaque valide." });
      return;
    }

    setSubmittingCompliance(true);
    try {
      const result = await submitCarrierDocuments({
        carrierVisitorId: userId,
        idCardStorageId: user.idCardPhotoId as any,
        carteGriseStorageId: user.carteGrisePhotoId as any,
        idCardExpiresAt,
        carteGriseExpiresAt,
        vehiclePlateNumber: plate,
      });
      setInlineFeedback({ type: "success", message: `Dossier envoye - Statut: ${result.status}.` });
    } catch {
      setInlineFeedback({ type: "error", message: "Impossible de soumettre le dossier transporteur." });
    } finally {
      setSubmittingCompliance(false);
    }
  };

  const handleSendCode = async () => {
    if (!email.trim() || !email.includes("@")) {
      Alert.alert("Email invalide", "Veuillez entrer un email valide.");
      return;
    }
    try {
      const result = await requestCode({ visitorId: userId, email: email.trim() });
      setCodeSent(true);
      Alert.alert(
        "Code envoye (BETA)",
        `Votre code de verification est : ${result.code}\n\nEn production, ce code serait envoye par email.`
      );
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer le code.");
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      Alert.alert("Code incomplet", "Entrez le code a 6 chiffres.");
      return;
    }
    setVerifying(true);
    try {
      const result = await verifyCode({
        visitorId: userId,
        email: email.trim(),
        code: verificationCode,
      });
      if (result.success) {
        Alert.alert("Email verifie", "Votre email a ete verifie !");
        setShowEmailForm(false);
      } else {
        Alert.alert("Erreur", result.error || "Code invalide.");
      }
    } catch {
      Alert.alert("Erreur", "Verification echouee.");
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Se deconnecter", "Etes-vous sur de vouloir vous deconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se deconnecter",
        style: "destructive",
        onPress: logout,
      },
    ]);
  };

  const handleEditTrip = (tripId: string) => {
    router.push({ pathname: "/(tabs)/offer", params: { tripId } });
  };

  const handleEditParcel = (parcelId: string) => {
    router.push({ pathname: "/(tabs)/send", params: { parcelId } });
  };

  const handleDeleteTrip = (tripId: string) => {
    Alert.alert("Supprimer ce trajet", "Cette annonce sera retiree de la carte. Continuer ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await removeTrip({ tripId: tripId as any, ownerVisitorId: userId });
            Alert.alert("Supprime", "Votre annonce trajet a ete retiree.");
          } catch {
            Alert.alert("Erreur", "Impossible de supprimer ce trajet.");
          }
        },
      },
    ]);
  };

  const handleDeleteParcel = (parcelId: string) => {
    Alert.alert("Supprimer ce colis", "Cette annonce sera retiree des matchs. Continuer ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await removeParcel({ parcelId: parcelId as any, ownerVisitorId: userId });
            Alert.alert("Supprime", "Votre annonce colis a ete retiree.");
          } catch {
            Alert.alert("Erreur", "Impossible de supprimer ce colis.");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.profileHeader}>
        {router.canGoBack() ? (
          <TouchableOpacity style={styles.headerBackButton} onPress={() => router.replace("/(tabs)" as any)}>
            <Ionicons name="arrow-back" size={16} color={Colors.dark.text} />
            <Text style={styles.headerBackButtonText}>Retour accueil</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.settingsButton} onPress={() => router.push("/settings" as any)}>
          <Ionicons name="settings-outline" size={18} color={Colors.dark.text} />
        </TouchableOpacity>

        <TouchableOpacity onPress={handlePickProfilePhoto} disabled={uploading}>
          {user.profilePhotoUrl ? (
            <Image
              source={{ uri: user.profilePhotoUrl }}
              style={styles.profilePhoto}
            />
          ) : (
            <View style={styles.avatarCircle}>
              {uploading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.avatarText}>
                  {user.name.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
          )}
          <View style={styles.cameraIcon}>
            <Ionicons name="camera" size={14} color="#FFF" />
          </View>
        </TouchableOpacity>
        <Text style={styles.userName}>{user.name}</Text>
        <View style={styles.headerBadges}>
          <StarRating
            rating={user.averageRating}
            totalReviews={user.totalReviews}
            size={14}
            color="#FDE68A"
          />
        </View>
        <View style={styles.headerBadges}>
          {user.emailVerified && <VerificationBadge type="email_verified" />}
          {user.identityVerified === "verified" && (
            <VerificationBadge type="identity_verified" />
          )}
        </View>
        <View style={styles.completionWrap}>
          <View style={styles.completionHeader}>
            <Text style={styles.completionText}>Profil complete a {completionPercent}%</Text>
            <Text style={styles.completionHint}>Completer les infos critiques</Text>
          </View>
          <View style={styles.completionTrack}>
            <View style={[styles.completionBar, { width: `${completionPercent}%` }]} />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
      >
        {inlineFeedback ? (
          <View
            style={[
              styles.inlineFeedback,
              inlineFeedback.type === "success" && styles.inlineFeedbackSuccess,
              inlineFeedback.type === "error" && styles.inlineFeedbackError,
              inlineFeedback.type === "info" && styles.inlineFeedbackInfo,
            ]}
          >
            <Text style={styles.inlineFeedbackText}>{inlineFeedback.message}</Text>
          </View>
        ) : null}

        <View style={styles.foldSection}>
          <TouchableOpacity style={styles.foldHeader} onPress={() => toggleSection("identity")} activeOpacity={0.85}>
            <Text style={styles.foldTitle}>Identite</Text>
            <Ionicons name={openSections.identity ? "chevron-up" : "chevron-down"} size={16} color={Colors.dark.textSecondary} />
          </TouchableOpacity>
          {openSections.identity ? (
            <View style={styles.foldBody}>
          <View style={styles.section}>
          <Text style={styles.sectionLabel}>Email</Text>
          {user.emailVerified && user.email ? (
            <View style={styles.infoRow}>
              <Ionicons name="mail" size={18} color={Colors.dark.primary} />
              <Text style={styles.infoText}>{user.email}</Text>
              <VerificationBadge type="email_verified" />
            </View>
          ) : !showEmailForm ? (
            <TouchableOpacity
              style={styles.outlineButton}
              onPress={() => setShowEmailForm(true)}
            >
              <Ionicons name="mail-outline" size={18} color={Colors.dark.primary} />
              <Text style={styles.outlineButtonText}>Ajouter un email</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.emailForm}>
              {!codeSent ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="votre@email.com"
                    placeholderTextColor={Colors.dark.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.smallPrimaryButton}
                    onPress={handleSendCode}
                  >
                    <Text style={styles.primaryButtonText}>Envoyer le code</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.codeLabel}>Code envoye a {email}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Code a 6 chiffres"
                    placeholderTextColor={Colors.dark.textSecondary}
                    value={verificationCode}
                    onChangeText={(t) =>
                      setVerificationCode(t.replace(/[^0-9]/g, "").slice(0, 6))
                    }
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={[
                      styles.smallPrimaryButton,
                      verifying && styles.disabledButton,
                    ]}
                    onPress={handleVerifyCode}
                    disabled={verifying}
                  >
                    {verifying ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Verifier</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity onPress={() => setShowEmailForm(false)}>
                <Text style={styles.linkText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          )}
          </View>
            </View>
          ) : null}
        </View>

        <View style={styles.foldSection}>
          <TouchableOpacity style={styles.foldHeader} onPress={() => toggleSection("verification")} activeOpacity={0.85}>
            <Text style={styles.foldTitle}>Verification</Text>
            <Ionicons name={openSections.verification ? "chevron-up" : "chevron-down"} size={16} color={Colors.dark.textSecondary} />
          </TouchableOpacity>
          {openSections.verification ? (
            <View style={styles.foldBody}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Verification identite</Text>
            <VerificationBadge type="beta" />
          </View>
          <Text style={styles.sectionDescription}>
            Verifiez votre identite pour rassurer les autres utilisateurs.
            Les transporteurs peuvent aussi ajouter leur carte grise.
          </Text>

          {compliance ? (
            <View style={styles.complianceCard}>
              <Text style={styles.complianceTitle}>Dossier transporteur</Text>
              <Text style={styles.complianceLine}>Statut: {compliance.status}</Text>
              <Text style={styles.complianceLine}>Risque: {compliance.riskLevel}</Text>
              {compliance.reviewReason ? <Text style={styles.complianceLine}>Motif: {compliance.reviewReason}</Text> : null}
            </View>
          ) : (
            <Text style={styles.sectionDescription}>Aucun dossier transporteur soumis.</Text>
          )}

          {user.identityVerified !== "none" && (
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Statut :</Text>
              <VerificationBadge
                type={`identity_${user.identityVerified}` as any}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.docButton, uploadingId && styles.disabledButton]}
            onPress={handleUploadIdCard}
            disabled={uploadingId}
          >
            {uploadingId ? (
              <ActivityIndicator color={Colors.dark.primary} size="small" />
            ) : (
              <>
                <Ionicons
                  name={user.idCardPhotoId ? "checkmark-circle" : "id-card-outline"}
                  size={20}
                  color={user.idCardPhotoId ? Colors.dark.success : Colors.dark.primary}
                />
                <Text style={styles.docButtonText}>
                  {user.idCardPhotoId
                    ? "Piece d'identite envoyee"
                    : "Envoyer piece d'identite"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.docButton, uploadingCg && styles.disabledButton]}
            onPress={handleUploadCarteGrise}
            disabled={uploadingCg}
          >
            {uploadingCg ? (
              <ActivityIndicator color={Colors.dark.primary} size="small" />
            ) : (
              <>
                <Ionicons
                  name={user.carteGrisePhotoId ? "checkmark-circle" : "car-outline"}
                  size={20}
                  color={user.carteGrisePhotoId ? Colors.dark.success : Colors.dark.primary}
                />
                <Text style={styles.docButtonText}>
                  {user.carteGrisePhotoId
                    ? "Carte grise envoyee"
                    : "Envoyer carte grise (transporteur)"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Expiration piece identite (YYYY-MM-DD)"
            placeholderTextColor={Colors.dark.textSecondary}
            value={idCardExpiryInput}
            onChangeText={setIdCardExpiryInput}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Expiration carte grise (YYYY-MM-DD)"
            placeholderTextColor={Colors.dark.textSecondary}
            value={carteGriseExpiryInput}
            onChangeText={setCarteGriseExpiryInput}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Numero de plaque"
            placeholderTextColor={Colors.dark.textSecondary}
            value={vehiclePlate}
            onChangeText={setVehiclePlate}
            autoCapitalize="characters"
          />

          <TouchableOpacity
            style={[styles.smallPrimaryButton, submittingCompliance && styles.disabledButton]}
            onPress={handleSubmitCompliance}
            disabled={submittingCompliance}
          >
            {submittingCompliance ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Soumettre dossier transporteur</Text>
            )}
          </TouchableOpacity>
        </View>
            </View>
          ) : null}
        </View>

        {/* Section Avis */}
        {reviews && reviews.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Avis recus ({reviews.length})
            </Text>
            {reviews.slice(0, 5).map((review) => (
              <View key={review._id} style={styles.reviewCard}>
                <StarRating rating={review.rating} size={12} />
                {review.comment && (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                )}
                <Text style={styles.reviewDate}>
                  {new Date(review.createdAt).toLocaleDateString("fr-FR")}
                </Text>
              </View>
            ))}
          </View>
        )}

        {isListLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : (
          <>
            <View style={styles.foldSection}>
              <TouchableOpacity style={styles.foldHeader} onPress={() => toggleSection("trips")} activeOpacity={0.85}>
                <Text style={styles.foldTitle}>Trajets</Text>
                <Ionicons name={openSections.trips ? "chevron-up" : "chevron-down"} size={16} color={Colors.dark.textSecondary} />
              </TouchableOpacity>
              {openSections.trips ? (
                <View style={styles.foldBody}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Mes trajets ({myTrips?.length ?? 0})
              </Text>
              <Text style={styles.sectionDescription}>Glissez vers la gauche pour modifier ou archiver.</Text>
              {myTrips && myTrips.length > 0 ? (
                myTrips.map((trip) => (
                  <SwipeActionRow
                    key={trip._id}
                    actions={[
                      {
                        label: "Modifier",
                        color: "#4338CA",
                        onPress: () => handleEditTrip(String(trip._id)),
                      },
                      {
                        label: "Archiver",
                        color: "#B91C1C",
                        onPress: () => handleDeleteTrip(String(trip._id)),
                      },
                    ]}
                  >
                    <View>
                      <TripCard trip={trip as any} />
                    </View>
                  </SwipeActionRow>
                ))
              ) : (
                <Text style={styles.emptySection}>
                  Vous navez pas encore propose de trajet
                </Text>
              )}
            </View>
                </View>
              ) : null}
            </View>

            <View style={styles.foldSection}>
              <TouchableOpacity style={styles.foldHeader} onPress={() => toggleSection("parcels")} activeOpacity={0.85}>
                <Text style={styles.foldTitle}>Colis</Text>
                <Ionicons name={openSections.parcels ? "chevron-up" : "chevron-down"} size={16} color={Colors.dark.textSecondary} />
              </TouchableOpacity>
              {openSections.parcels ? (
                <View style={styles.foldBody}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Mes colis ({myParcels?.length ?? 0})
              </Text>
              <Text style={styles.sectionDescription}>Glissez vers la gauche pour modifier ou archiver.</Text>
              {myParcels && myParcels.length > 0 ? (
                myParcels.map((parcel) => (
                  <SwipeActionRow
                    key={parcel._id}
                    actions={[
                      {
                        label: "Modifier",
                        color: "#4338CA",
                        onPress: () => handleEditParcel(String(parcel._id)),
                      },
                      {
                        label: "Archiver",
                        color: "#B91C1C",
                        onPress: () => handleDeleteParcel(String(parcel._id)),
                      },
                    ]}
                  >
                    <View>
                      <ParcelCard parcel={parcel as any} />
                    </View>
                  </SwipeActionRow>
                ))
              ) : (
                <Text style={styles.emptySection}>
                  Vous navez pas encore envoye de colis
                </Text>
              )}
            </View>
                </View>
              ) : null}
            </View>
          </>
        )}

        {/* Deconnexion */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Se deconnecter</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// ─── STYLES ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.dark.background,
  },

  // Auth / Registration
  authContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: Colors.dark.background,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.dark.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  authTitle: {
    fontSize: 22,
    color: Colors.dark.text,
    marginBottom: 8,
    fontFamily: Fonts.displaySemiBold,
  },
  authText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
    fontFamily: Fonts.sans,
  },

  // Inputs
  input: {
    backgroundColor: "#161D24",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.dark.text,
    width: "100%",
    marginBottom: 12,
    fontFamily: Fonts.sans,
  },
  codeLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
    textAlign: "center",
    fontFamily: Fonts.sans,
  },

  // Buttons
  primaryButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontFamily: Fonts.sansSemiBold,
  },
  smallPrimaryButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  skipButton: {
    marginTop: 20,
  },
  resendButton: {
    marginTop: 8,
  },
  linkText: {
    color: Colors.dark.primary,
    fontSize: 14,
    fontFamily: Fonts.sans,
    textAlign: "center",
  },
  outlineButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderStyle: "dashed",
  },
  outlineButtonText: {
    color: Colors.dark.primary,
    fontSize: 14,
    fontFamily: Fonts.sans,
  },

  // Profile Header
  profileHeader: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: Colors.dark.surface,
    position: "relative",
  },
  settingsButton: {
    position: "absolute",
    right: 16,
    top: 56,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.22)",
  },
  headerBackButton: {
    position: "absolute",
    left: 16,
    top: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: "rgba(15, 23, 42, 0.22)",
  },
  headerBackButtonText: {
    fontSize: 11,
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  avatarText: {
    fontSize: 30,
    color: Colors.dark.text,
    fontFamily: Fonts.displaySemiBold,
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: Colors.dark.surfaceMuted,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  userName: {
    fontSize: 20,
    color: Colors.dark.text,
    marginTop: 10,
    fontFamily: Fonts.displaySemiBold,
  },
  headerBadges: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  completionWrap: {
    width: "86%",
    marginTop: 12,
    gap: 6,
  },
  completionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  completionText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  completionHint: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontFamily: Fonts.sans,
  },
  completionTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: Colors.dark.border,
  },
  completionBar: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: Colors.dark.success,
  },

  // Scroll
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 20,
    paddingBottom: 28,
  },
  inlineFeedback: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  inlineFeedbackSuccess: {
    borderColor: "#14532D",
    backgroundColor: "#0E2C1D",
  },
  inlineFeedbackError: {
    borderColor: "#7F1D1D",
    backgroundColor: "#3F1D21",
  },
  inlineFeedbackInfo: {
    borderColor: "#1E3A8A",
    backgroundColor: "#1D2A47",
  },
  inlineFeedbackText: {
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  foldSection: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    marginBottom: 12,
    overflow: "hidden",
  },
  foldHeader: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.dark.surfaceMuted,
  },
  foldTitle: {
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  foldBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 16,
    color: Colors.dark.text,
    marginBottom: 10,
    fontFamily: Fonts.sansSemiBold,
  },
  sectionDescription: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
    fontFamily: Fonts.sans,
  },
  complianceCard: {
    backgroundColor: Colors.dark.surfaceMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
    padding: 10,
    marginBottom: 12,
  },
  complianceTitle: {
    fontSize: 13,
    color: Colors.dark.primary,
    marginBottom: 4,
    fontFamily: Fonts.sansSemiBold,
  },
  complianceLine: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 2,
    fontFamily: Fonts.sans,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontSize: 15,
    color: Colors.dark.text,
    flex: 1,
    fontFamily: Fonts.sans,
  },

  // Email form
  emailForm: {
    gap: 4,
  },

  // Identity docs
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sans,
  },
  docButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#161D24",
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  docButtonText: {
    fontSize: 14,
    color: Colors.dark.text,
    fontFamily: Fonts.sans,
  },

  // Reviews
  reviewCard: {
    backgroundColor: "#161D24",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  reviewComment: {
    fontSize: 13,
    color: Colors.dark.text,
    marginTop: 6,
    lineHeight: 18,
    fontFamily: Fonts.sans,
  },
  reviewDate: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 4,
    fontFamily: Fonts.sans,
  },

  // Trips / Parcels
  notificationCard: {
    backgroundColor: "#161D24",
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  notificationUnread: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primaryLight,
  },
  notificationTitle: {
    fontSize: 14,
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
  },
  notificationMessage: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
    fontFamily: Fonts.sans,
  },
  notificationActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  acceptButton: {
    backgroundColor: Colors.dark.success,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  acceptButtonText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  readButton: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#161D24",
  },
  readButtonText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  trackButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  trackButtonText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  emptySection: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontStyle: "italic",
    marginBottom: 8,
    fontFamily: Fonts.sans,
  },
  inlineActionsRow: {
    marginTop: -4,
    marginBottom: 10,
    flexDirection: "row",
    gap: 8,
  },
  inlineEditButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primaryLight,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  inlineEditText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  inlineDeleteButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#402328",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  inlineDeleteText: {
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "700",
  },

  // Logout
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutText: {
    color: Colors.dark.error,
    fontSize: 15,
    fontFamily: Fonts.sansSemiBold,
  },
  bottomSpacer: {
    height: 40,
  },
});
