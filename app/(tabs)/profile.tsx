import { useState } from "react";
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

export default function ProfileScreen() {
  const { userId, isLoggedIn, isLoading, register, user } = useUser();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
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
          placeholderTextColor="#94A3B8"
          value={name}
          onChangeText={setName}
          autoFocus
        />
        <TextInput
          style={styles.input}
          placeholder="Telephone (optionnel)"
          placeholderTextColor="#94A3B8"
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
        <Ionicons name="mail" size={48} color="#6366F1" />
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
            placeholderTextColor="#94A3B8"
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
            placeholderTextColor="#94A3B8"
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
  const notifications = useQuery(api.notifications.listForUser, { userId });
  const reviews = useQuery(api.reviews.getForUser, { revieweeId: userId });
  const shipments = useQuery(api.shipments.listForUser, { requesterVisitorId: userId, limit: 100 });
  const compliance = useQuery(api.compliance.getCarrierCompliance, { carrierVisitorId: userId });
  const { logout } = useUser();

  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const saveProfilePhoto = useMutation(api.users.saveProfilePhoto);
  const saveIdentityDocs = useMutation(api.users.saveIdentityDocuments);
  const submitCarrierDocuments = useMutation(api.compliance.submitCarrierDocuments);
  const removeTrip = useMutation(api.trips.remove);
  const removeParcel = useMutation(api.parcels.remove);
  const acceptReservationRequest = useMutation(api.matches.acceptReservationRequest);
  const markNotificationAsRead = useMutation(api.notifications.markAsRead);

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

  const requestCode = useMutation(api.emailVerification.requestCode);
  const verifyCode = useMutation(api.emailVerification.verifyCode);

  const isListLoading = myTrips === undefined || myParcels === undefined;

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
    try {
      const storageId = await uploadToConvex(uri, generateUploadUrl);
      await saveProfilePhoto({ visitorId: userId, storageId: storageId as any });
    } catch {
      Alert.alert("Erreur", "Impossible de sauvegarder la photo.");
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
    try {
      const storageId = await uploadToConvex(uri, generateUploadUrl);
      await saveIdentityDocs({
        visitorId: userId,
        idCardPhotoId: storageId as any,
        carteGrisePhotoId: user.carteGrisePhotoId as any,
      });
      Alert.alert("Envoye", "Votre piece d'identite a ete soumise.");
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer le document.");
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
    try {
      const storageId = await uploadToConvex(uri, generateUploadUrl);
      if (!user.idCardPhotoId) {
        Alert.alert(
          "Piece d'identite requise",
          "Veuillez d'abord envoyer votre piece d'identite."
        );
        return;
      }
      await saveIdentityDocs({
        visitorId: userId,
        idCardPhotoId: user.idCardPhotoId as any,
        carteGrisePhotoId: storageId as any,
      });
      Alert.alert("Envoye", "Votre carte grise a ete soumise.");
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer le document.");
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
      Alert.alert("Documents requis", "Ajoutez la piece identite et la carte grise avant envoi.");
      return;
    }

    const idCardExpiresAt = parseExpiryInputToTimestamp(idCardExpiryInput);
    const carteGriseExpiresAt = parseExpiryInputToTimestamp(carteGriseExpiryInput);
    if (!idCardExpiresAt || !carteGriseExpiresAt) {
      Alert.alert("Dates invalides", "Utilisez le format YYYY-MM-DD pour les deux dates.");
      return;
    }

    const plate = vehiclePlate.trim().toUpperCase();
    if (plate.length < 4) {
      Alert.alert("Plaque invalide", "Entrez un numero de plaque valide.");
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
      Alert.alert("Dossier envoye", `Statut actuel: ${result.status}`);
    } catch {
      Alert.alert("Erreur", "Impossible de soumettre le dossier transporteur.");
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

  const handleAcceptReservation = async (matchId: string) => {
    try {
      await acceptReservationRequest({
        matchId: matchId as any,
        parcelOwnerVisitorId: userId,
      });
      Alert.alert("Transport confirme", "Le transporteur a ete notifie. Paiement requis en BETA.");
    } catch {
      Alert.alert("Erreur", "Impossible d accepter cette demande pour le moment.");
    }
  };

  const handleMarkNotificationRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead({ notificationId: notificationId as any, userId });
    } catch {
      // Ignore read errors in UI.
    }
  };

  const handleOpenShipment = (shipmentId: string) => {
    router.push({ pathname: "/shipment/[shipmentId]", params: { shipmentId } });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.profileHeader}>
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
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Section Email */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Email</Text>
          {user.emailVerified && user.email ? (
            <View style={styles.infoRow}>
              <Ionicons name="mail" size={18} color="#6366F1" />
              <Text style={styles.infoText}>{user.email}</Text>
              <VerificationBadge type="email_verified" />
            </View>
          ) : !showEmailForm ? (
            <TouchableOpacity
              style={styles.outlineButton}
              onPress={() => setShowEmailForm(true)}
            >
              <Ionicons name="mail-outline" size={18} color="#6366F1" />
              <Text style={styles.outlineButtonText}>Ajouter un email</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.emailForm}>
              {!codeSent ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="votre@email.com"
                    placeholderTextColor="#94A3B8"
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
                    placeholderTextColor="#94A3B8"
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

        {/* Section Verification d'identite */}
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
              <ActivityIndicator color="#6366F1" size="small" />
            ) : (
              <>
                <Ionicons
                  name={user.idCardPhotoId ? "checkmark-circle" : "id-card-outline"}
                  size={20}
                  color={user.idCardPhotoId ? "#22C55E" : "#6366F1"}
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
              <ActivityIndicator color="#6366F1" size="small" />
            ) : (
              <>
                <Ionicons
                  name={user.carteGrisePhotoId ? "checkmark-circle" : "car-outline"}
                  size={20}
                  color={user.carteGrisePhotoId ? "#22C55E" : "#6366F1"}
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
            placeholderTextColor="#94A3B8"
            value={idCardExpiryInput}
            onChangeText={setIdCardExpiryInput}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Expiration carte grise (YYYY-MM-DD)"
            placeholderTextColor="#94A3B8"
            value={carteGriseExpiryInput}
            onChangeText={setCarteGriseExpiryInput}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Numero de plaque"
            placeholderTextColor="#94A3B8"
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

        {/* Section Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            Notifications ({notifications?.length ?? 0})
          </Text>
          {!notifications ? (
            <ActivityIndicator size="small" color="#6366F1" />
          ) : notifications.length === 0 ? (
            <Text style={styles.emptySection}>Aucune notification pour le moment</Text>
          ) : (
            notifications.map((notification) => {
              const canAcceptReservation =
                notification.type === "reservation_request" &&
                notification.matchId &&
                notification.matchStatus === "requested";
              const linkedShipment =
                notification.matchId && shipments
                  ? shipments.find((shipment) => String(shipment.matchId) === String(notification.matchId))
                  : null;

              return (
                <View
                  key={notification._id}
                  style={[styles.notificationCard, !notification.readAt && styles.notificationUnread]}
                >
                  <Text style={styles.notificationTitle}>{notification.title}</Text>
                  <Text style={styles.notificationMessage}>{notification.message}</Text>
                  <View style={styles.notificationActions}>
                    {canAcceptReservation ? (
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => handleAcceptReservation(String(notification.matchId))}
                      >
                        <Text style={styles.acceptButtonText}>Accepter le transport</Text>
                      </TouchableOpacity>
                    ) : null}

                    {linkedShipment ? (
                      <TouchableOpacity
                        style={styles.trackButton}
                        onPress={() => handleOpenShipment(String(linkedShipment._id))}
                      >
                        <Text style={styles.trackButtonText}>Ouvrir suivi</Text>
                      </TouchableOpacity>
                    ) : null}

                    {!notification.readAt ? (
                      <TouchableOpacity
                        style={styles.readButton}
                        onPress={() => handleMarkNotificationRead(String(notification._id))}
                      >
                        <Text style={styles.readButtonText}>Marquer lu</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Section Mes trajets / Mes colis */}
        {isListLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Mes trajets ({myTrips?.length ?? 0})
              </Text>
              {myTrips && myTrips.length > 0 ? (
                myTrips.map((trip) => (
                  <TripCard
                    key={trip._id}
                    trip={trip as any}
                    onEdit={() => handleEditTrip(String(trip._id))}
                    onDelete={() => handleDeleteTrip(String(trip._id))}
                  />
                ))
              ) : (
                <Text style={styles.emptySection}>
                  Vous navez pas encore propose de trajet
                </Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Mes colis ({myParcels?.length ?? 0})
              </Text>
              {myParcels && myParcels.length > 0 ? (
                myParcels.map((parcel) => (
                  <ParcelCard
                    key={parcel._id}
                    parcel={parcel as any}
                    onEdit={() => handleEditParcel(String(parcel._id))}
                    onDelete={() => handleDeleteParcel(String(parcel._id))}
                  />
                ))
              ) : (
                <Text style={styles.emptySection}>
                  Vous navez pas encore envoye de colis
                </Text>
              )}
            </View>
          </>
        )}

        {/* Deconnexion */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Se deconnecter</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── STYLES ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Auth / Registration
  authContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#F8FAFC",
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  authTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  authText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },

  // Inputs
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1E293B",
    width: "100%",
    marginBottom: 12,
  },
  codeLabel: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 8,
    textAlign: "center",
  },

  // Buttons
  primaryButton: {
    backgroundColor: "#6366F1",
    borderRadius: 12,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  smallPrimaryButton: {
    backgroundColor: "#6366F1",
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
    color: "#6366F1",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  outlineButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#6366F1",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderStyle: "dashed",
  },
  outlineButtonText: {
    color: "#6366F1",
    fontSize: 14,
    fontWeight: "500",
  },

  // Profile Header
  profileHeader: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#6366F1",
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
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  avatarText: {
    fontSize: 30,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#1E293B",
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
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 10,
  },
  headerBadges: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },

  // Scroll
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 20,
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
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 12,
  },
  complianceCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 10,
    marginBottom: 12,
  },
  complianceTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E3A8A",
    marginBottom: 4,
  },
  complianceLine: {
    fontSize: 12,
    color: "#1E40AF",
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontSize: 15,
    color: "#1E293B",
    flex: 1,
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
    color: "#64748B",
  },
  docButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  docButtonText: {
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "500",
  },

  // Reviews
  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  reviewComment: {
    fontSize: 13,
    color: "#1E293B",
    marginTop: 6,
    lineHeight: 18,
  },
  reviewDate: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
  },

  // Trips / Parcels
  notificationCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  notificationUnread: {
    borderColor: "#A5B4FC",
    backgroundColor: "#EEF2FF",
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  notificationMessage: {
    marginTop: 4,
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  notificationActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  acceptButton: {
    backgroundColor: "#16A34A",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  readButton: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
  },
  readButtonText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
  },
  trackButton: {
    backgroundColor: "#0284C7",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  trackButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  emptySection: {
    fontSize: 14,
    color: "#94A3B8",
    fontStyle: "italic",
    marginBottom: 8,
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
    color: "#EF4444",
    fontSize: 15,
    fontWeight: "600",
  },
});
