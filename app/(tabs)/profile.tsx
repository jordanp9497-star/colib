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
import { ProfileHistorySection } from "@/components/profile/ProfileHistorySection";
import { ProfileWalletSection } from "@/components/profile/ProfileWalletSection";
import { pickImage, takePhoto, uploadToConvex } from "@/utils/uploadImage";
import { SwipeActionRow } from "@/components/gestures/SwipeActionRow";
import { ActionButton } from "@/components/ui/action-button";
import { Colors, Fonts } from "@/constants/theme";
import { isJordanAdminName } from "@/constants/admin";
import { TERMS_CLAUSES, TERMS_LAST_UPDATED, TERMS_SUMMARY, TERMS_VERSION } from "@/packages/shared/legal";

export default function ProfileScreen() {
  const {
    userId,
    isLoggedIn,
    isLoading,
    registerWithPassword,
    loginWithPassword,
    requestPasswordResetCode,
    resetPasswordWithCode,
    loginWithGoogle,
    loginWithApple,
    logout,
    user,
  } = useUser();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <RegistrationFlow
        registerWithPassword={registerWithPassword}
        loginWithPassword={loginWithPassword}
        requestPasswordResetCode={requestPasswordResetCode}
        resetPasswordWithCode={resetPasswordWithCode}
        loginWithGoogle={loginWithGoogle}
        loginWithApple={loginWithApple}
        logout={logout}
      />
    );
  }

  return <LoggedInProfile userId={userId} user={user!} />;
}

// ─── INSCRIPTION ────────────────────────────────────────

function RegistrationFlow({
  registerWithPassword,
  loginWithPassword,
  requestPasswordResetCode,
  resetPasswordWithCode,
  loginWithGoogle,
  loginWithApple,
  logout,
}: {
  registerWithPassword: (
    profile: {
      givenName: string;
      familyName: string;
      phone: string;
      addressLine1: string;
      addressLine2?: string;
      city: string;
      postalCode: string;
      country: string;
      email: string;
      password: string;
    },
    termsAccepted?: boolean
  ) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  requestPasswordResetCode: (email: string) => Promise<{ success: boolean; code?: string; error?: string }>;
  resetPasswordWithCode: (email: string, code: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: (termsAccepted?: boolean) => Promise<void>;
  loginWithApple: (termsAccepted?: boolean) => Promise<void>;
  logout: () => void;
}) {
  type AuthStep = "welcome" | "register" | "registerSuccess" | "login" | "forgotPassword";

  const [authStep, setAuthStep] = useState<AuthStep>("welcome");
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("France");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [recentlyCreatedVisitorId, setRecentlyCreatedVisitorId] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetCodeRequested, setResetCodeRequested] = useState(false);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loginNotice) return;
    const timeoutId = setTimeout(() => setLoginNotice(null), 4000);
    return () => clearTimeout(timeoutId);
  }, [loginNotice]);

  const ensureTermsAccepted = () => {
    if (!termsAccepted) {
      Alert.alert(
        "Acceptation obligatoire",
        "Vous devez accepter les conditions d'utilisation pour creer un compte ou vous connecter."
      );
      return false;
    }
    return true;
  };

  const handleNameSubmit = async () => {
    if (
      !givenName.trim() ||
      !familyName.trim() ||
      !phone.trim() ||
      !addressLine1.trim() ||
      !city.trim() ||
      !postalCode.trim() ||
      !country.trim() ||
      !email.trim() ||
      !password.trim()
    ) {
      Alert.alert("Champs requis", "Completez le formulaire, y compris email et mot de passe.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Mot de passe", "Le mot de passe doit contenir au moins 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Mot de passe", "La confirmation du mot de passe ne correspond pas.");
      return;
    }
    if (!ensureTermsAccepted()) {
      return;
    }
    setRegisterLoading(true);
    try {
      await registerWithPassword(
        {
          givenName,
          familyName,
          phone,
          addressLine1,
          addressLine2: addressLine2 || undefined,
          city,
          postalCode,
          country,
          email,
          password,
        },
        true
      );
      const normalizedEmail = email.trim().toLowerCase();
      setRecentlyCreatedVisitorId(normalizedEmail);
      setLoginEmail(normalizedEmail);
      setLoginPassword("");
      logout();
      setAuthStep("registerSuccess");
    } catch (error) {
      Alert.alert("Creation impossible", error instanceof Error ? error.message : "Reessayez.");
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleLocalLogin = async () => {
    const targetEmail = loginEmail.trim().toLowerCase() || recentlyCreatedVisitorId;
    if (!targetEmail || !loginPassword.trim()) {
      Alert.alert("Connexion", "Entrez votre email et votre mot de passe.");
      return;
    }
    setAuthLoading(true);
    try {
      await loginWithPassword(targetEmail, loginPassword);
    } catch (error) {
      Alert.alert("Connexion impossible", error instanceof Error ? error.message : "Reessayez.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!ensureTermsAccepted()) {
      return;
    }

    setAuthLoading(true);
    try {
      await loginWithGoogle(true);
    } catch (error) {
      Alert.alert("Connexion Google impossible", error instanceof Error ? error.message : "Reessayez.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRequestResetCode = async () => {
    const emailValue = resetEmail.trim().toLowerCase();
    if (!emailValue.includes("@")) {
      Alert.alert("Email invalide", "Entrez un email valide.");
      return;
    }
    setResetLoading(true);
    try {
      const result = await requestPasswordResetCode(emailValue);
      if (!result.success) {
        Alert.alert("Demande impossible", result.error || "Reessayez.");
        return;
      }
      setResetCodeRequested(true);
      if (result.code) {
        Alert.alert("Code de reinitialisation (BETA)", `Votre code est: ${result.code}`);
      } else {
        Alert.alert("Code envoye", "Un code de reinitialisation vient d'etre envoye.");
      }
    } catch (error) {
      Alert.alert("Demande impossible", error instanceof Error ? error.message : "Reessayez.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const emailValue = resetEmail.trim().toLowerCase();
    if (!emailValue.includes("@")) {
      Alert.alert("Email invalide", "Entrez un email valide.");
      return;
    }
    if (resetCode.trim().length !== 6) {
      Alert.alert("Code invalide", "Entrez le code a 6 chiffres.");
      return;
    }
    if (resetNewPassword.length < 8) {
      Alert.alert("Mot de passe", "Le mot de passe doit contenir au moins 8 caracteres.");
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      Alert.alert("Mot de passe", "La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setResetLoading(true);
    try {
      const result = await resetPasswordWithCode(emailValue, resetCode.trim(), resetNewPassword);
      if (!result.success) {
        Alert.alert("Reinitialisation impossible", result.error || "Reessayez.");
        return;
      }
      setLoginNotice("Mot de passe modifie. Vous pouvez maintenant vous connecter.");
      setLoginEmail(emailValue);
      setLoginPassword("");
      setResetCode("");
      setResetNewPassword("");
      setResetConfirmPassword("");
      setResetCodeRequested(false);
      setAuthStep("login");
    } catch (error) {
      Alert.alert("Reinitialisation impossible", error instanceof Error ? error.message : "Reessayez.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    if (!ensureTermsAccepted()) {
      return;
    }

    setAuthLoading(true);
    try {
      await loginWithApple(true);
    } catch (error) {
      Alert.alert("Connexion Apple impossible", error instanceof Error ? error.message : "Reessayez.");
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.authContainer} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.authScroll}
        contentContainerStyle={styles.authScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person" size={48} color={Colors.dark.textSecondary} />
        </View>
        <Text style={styles.authTitle}>Bienvenue sur Colib</Text>
        <Text style={styles.authText}>Inscrivez-vous ou connectez-vous pour publier et reserver des trajets.</Text>

        {authStep === "welcome" ? (
          <View style={styles.authStepCard}>
            <TouchableOpacity style={styles.entryButton} onPress={() => setAuthStep("register")} activeOpacity={0.9}>
              <Text style={styles.entryButtonText}>{"S'enregistrer"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.entryGhostButton} onPress={() => setAuthStep("login")} activeOpacity={0.9}>
              <Text style={styles.entryGhostButtonText}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {authStep === "register" ? (
          <View style={styles.registrationFormCard}>
            <View style={styles.authStepHeader}>
              <TouchableOpacity style={styles.backInlineButton} onPress={() => setAuthStep("welcome")}>
                <Ionicons name="chevron-back" size={16} color={Colors.dark.textSecondary} />
                <Text style={styles.backInlineButtonText}>Retour</Text>
              </TouchableOpacity>
              <Text style={styles.registrationFormTitle}>Etape 2 - Creer votre profil</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Prenom"
              placeholderTextColor={Colors.dark.textSecondary}
              value={givenName}
              onChangeText={setGivenName}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Nom"
              placeholderTextColor={Colors.dark.textSecondary}
              value={familyName}
              onChangeText={setFamilyName}
            />
            <TextInput
              style={styles.input}
              placeholder="Telephone"
              placeholderTextColor={Colors.dark.textSecondary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Numero et rue"
              placeholderTextColor={Colors.dark.textSecondary}
              value={addressLine1}
              onChangeText={setAddressLine1}
            />
            <TextInput
              style={styles.input}
              placeholder="Complement d'adresse (optionnel)"
              placeholderTextColor={Colors.dark.textSecondary}
              value={addressLine2}
              onChangeText={setAddressLine2}
            />
            <View style={styles.authRow}>
              <TextInput
                style={[styles.input, styles.authHalfInput]}
                placeholder="Ville"
                placeholderTextColor={Colors.dark.textSecondary}
                value={city}
                onChangeText={setCity}
              />
              <TextInput
                style={[styles.input, styles.authHalfInput]}
                placeholder="Code postal"
                placeholderTextColor={Colors.dark.textSecondary}
                value={postalCode}
                onChangeText={setPostalCode}
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Pays"
              placeholderTextColor={Colors.dark.textSecondary}
              value={country}
              onChangeText={setCountry}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.dark.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              placeholderTextColor={Colors.dark.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Confirmer le mot de passe"
              placeholderTextColor={Colors.dark.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!termsAccepted || authLoading || registerLoading) && styles.primaryButtonDisabled,
              ]}
              onPress={handleNameSubmit}
              disabled={!termsAccepted || authLoading || registerLoading}
            >
              <Text style={styles.primaryButtonText}>{registerLoading ? "Creation..." : "Valider l'inscription"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.termsCheckRow} onPress={() => setTermsAccepted((value) => !value)} activeOpacity={0.85}>
              <Ionicons
                name={termsAccepted ? "checkbox" : "square-outline"}
                size={22}
                color={termsAccepted ? Colors.dark.primary : Colors.dark.textSecondary}
              />
              <Text style={styles.termsCheckText}>
                {"J'accepte les conditions d'utilisation et je reconnais que Colib est uniquement une plateforme de mise en relation."}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.termsToggleButton} onPress={() => setShowTerms((value) => !value)}>
              <Text style={styles.termsToggleText}>{showTerms ? "Masquer les conditions" : "Lire les conditions d'utilisation"}</Text>
            </TouchableOpacity>

            {showTerms ? (
              <View style={styles.termsCard}>
                <Text style={styles.termsTitle}>{"Conditions d'utilisation"}</Text>
                <Text style={styles.termsMeta}>Version: {TERMS_VERSION} - Derniere mise a jour: {TERMS_LAST_UPDATED}</Text>
                <Text style={styles.termsSummary}>{TERMS_SUMMARY}</Text>
                {TERMS_CLAUSES.map((clause) => (
                  <View key={clause.title} style={styles.termsClause}>
                    <Text style={styles.termsClauseTitle}>{clause.title}</Text>
                    <Text style={styles.termsClauseBody}>{clause.body}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {authStep === "registerSuccess" ? (
          <View style={styles.authStepCard}>
            <Ionicons name="checkmark-circle" size={34} color={Colors.dark.success} />
            <Text style={styles.successTitle}>Etape 3 - Profil cree</Text>
            <Text style={styles.successText}>Votre profil a bien ete enregistre. Vous pouvez revenir a la connexion pour acceder a votre compte.</Text>
            <TouchableOpacity style={styles.entryButton} onPress={() => setAuthStep("login")} activeOpacity={0.9}>
              <Text style={styles.entryButtonText}>Retour a la connexion</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {authStep === "login" ? (
          <View style={styles.socialLoginCard}>
            <View style={styles.authStepHeader}>
              <TouchableOpacity style={styles.backInlineButton} onPress={() => setAuthStep("welcome")}>
                <Ionicons name="chevron-back" size={16} color={Colors.dark.textSecondary} />
                <Text style={styles.backInlineButtonText}>Retour</Text>
              </TouchableOpacity>
              <Text style={styles.socialLoginTitle}>Se connecter</Text>
            </View>

            {recentlyCreatedVisitorId ? (
              <Text style={styles.loginHintText}>Compte cree: {recentlyCreatedVisitorId}</Text>
            ) : null}

            {loginNotice ? (
              <View style={styles.authNoticeCard}>
                <Ionicons name="checkmark-circle" size={15} color={Colors.dark.success} />
                <Text style={styles.authNoticeText}>{loginNotice}</Text>
              </View>
            ) : null}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.dark.textSecondary}
              value={loginEmail}
              onChangeText={setLoginEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              placeholderTextColor={Colors.dark.textSecondary}
              value={loginPassword}
              onChangeText={setLoginPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.localLoginButton, authLoading && styles.secondaryButtonDisabled]}
              onPress={handleLocalLogin}
              disabled={authLoading}
              activeOpacity={0.9}
            >
              <Ionicons name="log-in-outline" size={18} color={Colors.dark.text} />
              <Text style={styles.localLoginButtonText}>{authLoading ? "Connexion..." : "Se connecter"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => {
                setResetEmail(loginEmail);
                setResetCode("");
                setResetNewPassword("");
                setResetConfirmPassword("");
                setResetCodeRequested(false);
                setLoginNotice(null);
                setAuthStep("forgotPassword");
              }}
            >
              <Text style={styles.linkButtonText}>Mot de passe oublie ?</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.termsCheckRow} onPress={() => setTermsAccepted((value) => !value)} activeOpacity={0.85}>
              <Ionicons
                name={termsAccepted ? "checkbox" : "square-outline"}
                size={20}
                color={termsAccepted ? Colors.dark.primary : Colors.dark.textSecondary}
              />
              <Text style={styles.termsCheckText}>{"J'accepte les conditions d'utilisation."}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.termsToggleButton} onPress={() => setShowTerms((value) => !value)}>
              <Text style={styles.termsToggleText}>{showTerms ? "Masquer les conditions" : "Lire les conditions"}</Text>
            </TouchableOpacity>

            {showTerms ? (
              <View style={styles.termsCard}>
                <Text style={styles.termsTitle}>{"Conditions d'utilisation"}</Text>
                <Text style={styles.termsMeta}>Version: {TERMS_VERSION} - Derniere mise a jour: {TERMS_LAST_UPDATED}</Text>
                <Text style={styles.termsSummary}>{TERMS_SUMMARY}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.googleButton, (authLoading || !termsAccepted) && styles.secondaryButtonDisabled]}
              onPress={handleGoogleLogin}
              disabled={authLoading || !termsAccepted}
              activeOpacity={0.9}
            >
              <Ionicons name="logo-google" size={18} color="#DB4437" />
              <Text style={styles.googleButtonText}>{authLoading ? "Connexion..." : "Se connecter avec Google"}</Text>
            </TouchableOpacity>
            {Platform.OS === "ios" ? (
              <TouchableOpacity
                style={[styles.appleButton, (authLoading || !termsAccepted) && styles.secondaryButtonDisabled]}
                onPress={handleAppleLogin}
                disabled={authLoading || !termsAccepted}
                activeOpacity={0.9}
              >
                <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                <Text style={styles.appleButtonText}>{authLoading ? "Connexion..." : "Se connecter avec Apple"}</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.testLoginHint}>Google: iOS/Android/Web. Apple: uniquement iOS.</Text>
          </View>
        ) : null}

        {authStep === "forgotPassword" ? (
          <View style={styles.socialLoginCard}>
            <View style={styles.authStepHeader}>
              <TouchableOpacity style={styles.backInlineButton} onPress={() => setAuthStep("login")}>
                <Ionicons name="chevron-back" size={16} color={Colors.dark.textSecondary} />
                <Text style={styles.backInlineButtonText}>Retour</Text>
              </TouchableOpacity>
              <Text style={styles.socialLoginTitle}>Reinitialiser le mot de passe</Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.dark.textSecondary}
              value={resetEmail}
              onChangeText={setResetEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {!resetCodeRequested ? (
              <TouchableOpacity
                style={[styles.localLoginButton, resetLoading && styles.secondaryButtonDisabled]}
                onPress={handleRequestResetCode}
                disabled={resetLoading}
              >
                <Ionicons name="mail-open-outline" size={18} color={Colors.dark.text} />
                <Text style={styles.localLoginButtonText}>{resetLoading ? "Envoi..." : "Recevoir un code"}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Code a 6 chiffres"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={resetCode}
                  onChangeText={(value) => setResetCode(value.replace(/[^0-9]/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Nouveau mot de passe"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={resetNewPassword}
                  onChangeText={setResetNewPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Confirmer le nouveau mot de passe"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={resetConfirmPassword}
                  onChangeText={setResetConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.localLoginButton, resetLoading && styles.secondaryButtonDisabled]}
                  onPress={handleResetPassword}
                  disabled={resetLoading}
                >
                  <Ionicons name="key-outline" size={18} color={Colors.dark.text} />
                  <Text style={styles.localLoginButtonText}>{resetLoading ? "Mise a jour..." : "Valider"}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}
      </ScrollView>
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
  const myShipments = useQuery(api.shipments.listForUser, {
    requesterVisitorId: userId,
    limit: 120,
  });
  const reviews = useQuery(api.reviews.getForUser, { revieweeId: userId });
  const compliance = useQuery(api.compliance.getCarrierCompliance, { carrierVisitorId: userId });
  const { logout } = useUser();

  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const saveProfilePhoto = useMutation(api.users.saveProfilePhoto);
  const saveIdentityDocs = useMutation(api.users.saveIdentityDocuments);
  const updateName = useMutation(api.users.updateName);
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
  const [editingPseudo, setEditingPseudo] = useState(false);
  const [pseudoInput, setPseudoInput] = useState(user.name);
  const [savingPseudo, setSavingPseudo] = useState(false);

  // Email verification (si pas encore fait)
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [openSections, setOpenSections] = useState({
    identity: true,
    verification: true,
    history: true,
    wallet: true,
    trips: false,
    parcels: false,
  });
  const [verificationMenuOpen, setVerificationMenuOpen] = useState(false);
  const [inlineFeedback, setInlineFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const isJordanAdmin = isJordanAdminName(user.name);

  const requestCode = useMutation(api.emailVerification.requestCode);
  const verifyCode = useMutation(api.emailVerification.verifyCode);

  const isListLoading = myTrips === undefined || myParcels === undefined || myShipments === undefined;
  const completionChecks = [
    Boolean(user.name.trim()),
    Boolean(user.phone?.trim()),
    Boolean(user.addressLine1?.trim()),
    Boolean(user.city?.trim()),
    Boolean(user.postalCode?.trim()),
    Boolean(user.emailVerified),
    Boolean(user.profilePhotoUrl),
    Boolean(user.identityVerified === "verified"),
  ];
  const completionPercent = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100);

  const shipmentRows = (myShipments ?? []).map((shipment) => {
    const isCarrier = shipment.carrierVisitorId === userId;
    const role: "transporteur" | "expediteur" = isCarrier ? "transporteur" : "expediteur";
    return {
      id: String(shipment._id),
      role,
      status: shipment.status,
      paymentStatus: shipment.paymentStatus,
      amount: shipment.paymentAmount,
      currency: shipment.paymentCurrency,
      updatedAt: shipment.updatedAt,
      deliveredAt: shipment.deliveredAt,
    };
  });

  const completedHistory = shipmentRows.filter((entry) => entry.status === "delivered");
  const shippedAsCarrier = completedHistory.filter((entry) => entry.role === "transporteur").length;
  const shippedAsSender = completedHistory.filter((entry) => entry.role === "expediteur").length;

  const walletReleased = shipmentRows
    .filter((entry) => entry.role === "transporteur" && entry.paymentStatus === "released")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const walletPending = shipmentRows
    .filter(
      (entry) =>
        entry.role === "transporteur" && (entry.paymentStatus === "held" || entry.paymentStatus === "release_pending")
    )
    .reduce((sum, entry) => sum + entry.amount, 0);
  const walletSpent = shipmentRows
    .filter((entry) => entry.role === "expediteur" && entry.paymentStatus !== "failed")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const walletCompletedPayouts = shipmentRows.filter(
    (entry) => entry.role === "transporteur" && entry.paymentStatus === "released"
  ).length;

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
      if (!result.success) {
        Alert.alert("Envoi impossible", result.error || "Impossible d'envoyer le code.");
        return;
      }
      setCodeSent(true);
      if ("code" in result && result.code) {
        Alert.alert("Code envoye (BETA)", `Votre code de verification est : ${result.code}`);
      } else {
        Alert.alert("Code envoye", "Un code de verification a ete envoye a votre email.");
      }
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

  const handleSavePseudo = async () => {
    const nextPseudo = pseudoInput.trim();
    if (!nextPseudo) {
      setInlineFeedback({ type: "error", message: "Le pseudo ne peut pas etre vide." });
      return;
    }
    if (nextPseudo.length < 3) {
      setInlineFeedback({ type: "error", message: "Le pseudo doit contenir au moins 3 caracteres." });
      return;
    }

    setSavingPseudo(true);
    try {
      await updateName({ visitorId: userId, name: nextPseudo });
      setInlineFeedback({ type: "success", message: "Pseudo mis a jour." });
      setEditingPseudo(false);
    } catch {
      setInlineFeedback({ type: "error", message: "Impossible de mettre a jour le pseudo." });
    } finally {
      setSavingPseudo(false);
    }
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
          <TouchableOpacity
            style={styles.headerBackButton}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as any))}
          >
            <Ionicons name="arrow-back" size={16} color={Colors.dark.text} />
            <Text style={styles.headerBackButtonText}>Retour</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.settingsButton} onPress={() => router.push("/settings" as any)}>
          <Ionicons name="settings-outline" size={18} color={Colors.dark.text} />
        </TouchableOpacity>

        {isJordanAdmin ? (
          <TouchableOpacity style={styles.adminButton} onPress={() => router.push("/admin-support" as any)}>
            <Ionicons name="shield-checkmark-outline" size={15} color={Colors.dark.text} />
            <Text style={styles.adminButtonText}>Admin BETA</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity onPress={handlePickProfilePhoto} disabled={uploading}>
          {user.profilePhotoUrl ? (
            <Image
              source={{ uri: user.profilePhotoUrl }}
              style={styles.profilePhoto}
            />
          ) : (
            <View style={styles.avatarCircle}>
              {uploading ? (
                <ActivityIndicator color={Colors.dark.text} />
              ) : (
                <Text style={styles.avatarText}>
                  {user.name.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
          )}
          <View style={styles.cameraIcon}>
            <Ionicons name="camera" size={14} color={Colors.dark.text} />
          </View>
        </TouchableOpacity>
        {editingPseudo ? (
          <View style={styles.pseudoEditorWrap}>
            <TextInput
              style={styles.pseudoInput}
              value={pseudoInput}
              onChangeText={setPseudoInput}
              placeholder="Votre pseudo"
              placeholderTextColor={Colors.dark.textSecondary}
              autoCapitalize="none"
              maxLength={40}
            />
            <View style={styles.pseudoActionRow}>
              <TouchableOpacity
                style={[styles.pseudoSaveButton, savingPseudo && styles.secondaryButtonDisabled]}
                onPress={handleSavePseudo}
                disabled={savingPseudo}
              >
                <Text style={styles.pseudoSaveText}>{savingPseudo ? "Enregistrement..." : "Valider"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pseudoCancelButton}
                onPress={() => {
                  setPseudoInput(user.name);
                  setEditingPseudo(false);
                }}
              >
                <Text style={styles.pseudoCancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.userNameRow}>
            <Text style={styles.userName}>{user.name}</Text>
            <TouchableOpacity style={styles.editPseudoButton} onPress={() => setEditingPseudo(true)}>
              <Ionicons name="create-outline" size={14} color={Colors.dark.text} />
              <Text style={styles.editPseudoText}>Modifier le pseudo</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.headerBadges}>
          <StarRating
            rating={user.averageRating}
            totalReviews={user.totalReviews}
            size={14}
            color={Colors.dark.warning}
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
        nestedScrollEnabled
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
                  <ActionButton label="Envoyer le code" size="sm" style={styles.smallPrimaryButton} onPress={handleSendCode} />
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
                  <ActionButton
                    label="Verifier"
                    size="sm"
                    style={styles.smallPrimaryButton}
                    loading={verifying}
                    onPress={handleVerifyCode}
                  />
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

          <TouchableOpacity style={styles.submenuButton} onPress={() => setVerificationMenuOpen((prev) => !prev)}>
            <Ionicons name={verificationMenuOpen ? "chevron-up" : "chevron-down"} size={16} color={Colors.dark.text} />
            <Text style={styles.submenuButtonText}>Dossier identite & carte grise</Text>
          </TouchableOpacity>

          {verificationMenuOpen ? (
            <View style={styles.submenuCard}>

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

          <ActionButton
            label="Soumettre dossier transporteur"
            size="sm"
            style={styles.smallPrimaryButton}
            loading={submittingCompliance}
            onPress={handleSubmitCompliance}
          />
            </View>
          ) : null}
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
            <ProfileHistorySection
              open={openSections.history}
              onToggle={() => toggleSection("history")}
              shippedAsCarrier={shippedAsCarrier}
              shippedAsSender={shippedAsSender}
              completedHistory={completedHistory}
            />

            <ProfileWalletSection
              open={openSections.wallet}
              onToggle={() => toggleSection("wallet")}
              walletReleased={walletReleased}
              walletPending={walletPending}
              walletSpent={walletSpent}
              walletCompletedPayouts={walletCompletedPayouts}
              currency="EUR"
            />

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
              <Text style={styles.sectionDescription}>Glissez vers la gauche pour modifier ou archiver, ou utilisez les boutons.</Text>
              {myTrips && myTrips.length > 0 ? (
                myTrips.map((trip) => (
                  <SwipeActionRow
                    key={trip._id}
                    actions={[
                      {
                        label: "Modifier",
                        color: Colors.dark.primary,
                        onPress: () => handleEditTrip(String(trip._id)),
                      },
                      {
                        label: "Archiver",
                        color: Colors.dark.error,
                        onPress: () => handleDeleteTrip(String(trip._id)),
                      },
                    ]}
                  >
                    <View>
                      <TripCard
                        trip={trip as any}
                        onEdit={() => handleEditTrip(String(trip._id))}
                        onDelete={() => handleDeleteTrip(String(trip._id))}
                      />
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
              <Text style={styles.sectionDescription}>Glissez vers la gauche pour modifier ou archiver, ou utilisez les boutons.</Text>
              {myParcels && myParcels.length > 0 ? (
                myParcels.map((parcel) => (
                  <SwipeActionRow
                    key={parcel._id}
                    actions={[
                      {
                        label: "Modifier",
                        color: Colors.dark.primary,
                        onPress: () => handleEditParcel(String(parcel._id)),
                      },
                      {
                        label: "Archiver",
                        color: Colors.dark.error,
                        onPress: () => handleDeleteParcel(String(parcel._id)),
                      },
                    ]}
                  >
                    <View>
                      <ParcelCard
                        parcel={parcel as any}
                        onEdit={() => handleEditParcel(String(parcel._id))}
                        onDelete={() => handleDeleteParcel(String(parcel._id))}
                      />
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
          <Ionicons name="log-out-outline" size={20} color={Colors.dark.error} />
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
    paddingHorizontal: 20,
    backgroundColor: Colors.dark.background,
  },
  authScroll: {
    flex: 1,
    width: "100%",
  },
  authScrollContent: {
    paddingVertical: 24,
  },
  avatarPlaceholder: {
    alignSelf: "center",
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
    textAlign: "center",
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
    backgroundColor: Colors.dark.surfaceMuted,
    borderRadius: 12,
    borderWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.dark.text,
    width: "100%",
    marginBottom: 12,
    fontFamily: Fonts.sans,
  },
  authRow: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
  },
  authHalfInput: {
    flex: 1,
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
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontFamily: Fonts.sansSemiBold,
  },
  entryButton: {
    width: "100%",
    borderRadius: 12,
    minHeight: 48,
    backgroundColor: Colors.dark.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  entryButtonText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontFamily: Fonts.sansSemiBold,
  },
  entryGhostButton: {
    width: "100%",
    borderRadius: 12,
    minHeight: 46,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  entryGhostButtonText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  authStepCard: {
    width: "100%",
    borderWidth: 0,
    borderRadius: 12,
    padding: 14,
    backgroundColor: Colors.dark.surface,
    gap: 10,
  },
  authStepHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  backInlineButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  backInlineButtonText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  registrationFormCard: {
    width: "100%",
    borderWidth: 0,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    backgroundColor: Colors.dark.surface,
  },
  registrationFormTitle: {
    fontSize: 14,
    color: Colors.dark.text,
    marginBottom: 10,
    fontFamily: Fonts.sansSemiBold,
  },
  testLoginCard: {
    marginTop: 18,
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: Colors.dark.surface,
  },
  testLoginTitle: {
    fontSize: 14,
    color: Colors.dark.text,
    marginBottom: 8,
    fontFamily: Fonts.sansSemiBold,
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
    marginTop: 2,
    backgroundColor: Colors.dark.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontFamily: Fonts.sansSemiBold,
  },
  testLoginHint: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sans,
  },
  socialLoginCard: {
    marginTop: 6,
    width: "100%",
    borderWidth: 0,
    borderRadius: 12,
    padding: 14,
    backgroundColor: Colors.dark.surface,
    gap: 10,
  },
  socialLoginTitle: {
    fontSize: 14,
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
  },
  localLoginButton: {
    borderRadius: 12,
    minHeight: 44,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: Colors.dark.primary,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  localLoginButtonText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  loginHintText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sans,
    marginBottom: 2,
  },
  authNoticeCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.success,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  authNoticeText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
    flex: 1,
  },
  linkButton: {
    alignSelf: "flex-start",
    paddingVertical: 2,
  },
  linkButtonText: {
    color: Colors.dark.primary,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  googleButton: {
    borderRadius: 12,
    minHeight: 46,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  googleButtonText: {
    color: "#202124",
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  appleButton: {
    borderRadius: 12,
    minHeight: 46,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#101010",
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  appleButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  successTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontFamily: Fonts.sansSemiBold,
  },
  successText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.sans,
    marginBottom: 8,
  },
  smallPrimaryButton: {
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
  termsCheckRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  termsCheckText: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.sans,
  },
  termsToggleButton: {
    alignSelf: "flex-start",
    marginTop: 2,
    marginBottom: 4,
  },
  termsToggleText: {
    color: Colors.dark.primary,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  termsCard: {
    width: "100%",
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 12,
  },
  termsTitle: {
    color: Colors.dark.text,
    fontSize: 15,
    fontFamily: Fonts.sansSemiBold,
    marginBottom: 4,
  },
  termsMeta: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sans,
    marginBottom: 8,
  },
  termsSummary: {
    color: Colors.dark.text,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: Fonts.sans,
    marginBottom: 10,
  },
  termsClause: {
    marginBottom: 9,
  },
  termsClauseTitle: {
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
    marginBottom: 2,
  },
  termsClauseBody: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Fonts.sans,
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
    paddingBottom: 16,
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
  adminButton: {
    position: "absolute",
    right: 56,
    top: 56,
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: 10,
    gap: 4,
    backgroundColor: "rgba(15, 23, 42, 0.22)",
  },
  adminButtonText: {
    color: Colors.dark.text,
    fontSize: 11,
    fontFamily: Fonts.sansSemiBold,
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
    borderColor: Colors.dark.text,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: Colors.dark.text,
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
    borderColor: Colors.dark.text,
  },
  userName: {
    fontSize: 20,
    color: Colors.dark.text,
    marginTop: 10,
    fontFamily: Fonts.displaySemiBold,
  },
  userNameRow: {
    marginTop: 10,
    alignItems: "center",
    gap: 6,
  },
  editPseudoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: Colors.dark.surfaceMuted,
  },
  editPseudoText: {
    color: Colors.dark.text,
    fontSize: 11,
    fontFamily: Fonts.sansSemiBold,
  },
  pseudoEditorWrap: {
    width: "86%",
    marginTop: 10,
    gap: 6,
  },
  pseudoInput: {
    width: "100%",
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceMuted,
    color: Colors.dark.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: Fonts.sans,
  },
  pseudoActionRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  pseudoSaveButton: {
    borderRadius: 9,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pseudoSaveText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  pseudoCancelButton: {
    borderRadius: 9,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pseudoCancelText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
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
    borderColor: Colors.dark.success,
    backgroundColor: Colors.dark.surfaceMuted,
  },
  inlineFeedbackError: {
    borderColor: Colors.dark.error,
    backgroundColor: Colors.dark.surfaceMuted,
  },
  inlineFeedbackInfo: {
    borderColor: Colors.dark.info,
    backgroundColor: Colors.dark.surfaceMuted,
  },
  inlineFeedbackText: {
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  foldSection: {
    borderRadius: 12,
    borderWidth: 0,
    backgroundColor: Colors.dark.surface,
    marginBottom: 10,
    overflow: "hidden",
  },
  foldHeader: {
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 11,
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
    paddingTop: 10,
    paddingBottom: 2,
  },

  // Sections
  section: {
    marginBottom: 18,
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
    borderWidth: 0,
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
    backgroundColor: Colors.dark.surfaceMuted,
    borderWidth: 0,
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
  submenuButton: {
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: Colors.dark.surfaceMuted,
    minHeight: 42,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submenuButtonText: {
    fontSize: 13,
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
  },
  submenuCard: {
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: Colors.dark.surfaceMuted,
    padding: 10,
  },

  // Reviews
  reviewCard: {
    backgroundColor: Colors.dark.surfaceMuted,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 0,
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
    backgroundColor: Colors.dark.surfaceMuted,
    borderWidth: 0,
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
    borderWidth: 0,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.dark.surfaceMuted,
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
    borderWidth: 0,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  inlineDeleteText: {
    color: Colors.dark.error,
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
