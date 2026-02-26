import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { ActionButton } from "@/components/ui/action-button";
import { BackButton } from "@/components/ui/back-button";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { pickImage, takePhoto, uploadToConvex } from "@/utils/uploadImage";
import { computeDynamicPrice } from "@/packages/shared/pricing";
import { distancePointToSegmentKm } from "@/packages/shared/tripSessionMatching";
import type { GeocodedAddress } from "@/packages/shared/maps";
import { buildWindowTimestamps, TimeWindowInput, type SlotKey } from "@/components/forms/TimeWindowInput";
import { Colors, Fonts } from "@/constants/theme";
import { useSearchFlow } from "@/context/SearchFlowContext";

const TOTAL_STEPS = 4;
const PROPOSAL_DEFAULT_SIZE: "petit" | "moyen" | "grand" = "petit";
const PROPOSAL_DEFAULT_WEIGHT = 2;
const PROPOSAL_DEFAULT_VOLUME = 12;

const PHONE_PREFIXES = [
  { flag: "🇫🇷", label: "France", code: "+33" },
  { flag: "🇧🇪", label: "Belgique", code: "+32" },
  { flag: "🇨🇭", label: "Suisse", code: "+41" },
  { flag: "🇪🇸", label: "Espagne", code: "+34" },
  { flag: "🇮🇹", label: "Italie", code: "+39" },
] as const;

type PhonePrefix = (typeof PHONE_PREFIXES)[number];

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function toInternationalPhone(prefix: string, localValue: string) {
  const digits = onlyDigits(localValue);
  if (!digits) return "";
  if (prefix === "+33" && digits.length === 10 && digits.startsWith("0")) {
    return `${prefix}${digits.slice(1)}`;
  }
  return `${prefix}${digits}`;
}

function toLocalPhone(prefix: string, internationalPhone: string) {
  const normalized = internationalPhone.trim();
  if (!normalized.startsWith(prefix)) {
    return onlyDigits(normalized);
  }
  const withoutPrefix = normalized.slice(prefix.length);
  const digits = onlyDigits(withoutPrefix);
  if (prefix === "+33" && digits.length === 9) {
    return `0${digits}`;
  }
  return digits;
}

function projectProgressOnSegment(
  point: { lat: number; lng: number },
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
) {
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return 0;
  const rawT = ((point.lng - start.lng) * dx + (point.lat - start.lat) * dy) / lengthSq;
  return Math.max(0, Math.min(1, rawT));
}

function hasValidLatLng(value: unknown): value is { lat: number; lng: number } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { lat?: number; lng?: number };
  return Number.isFinite(candidate.lat) && Number.isFinite(candidate.lng);
}

export default function SendScreen() {
  const { userId, userName, isLoggedIn } = useUser();
  const { newSearch } = useSearchFlow();
  const params = useLocalSearchParams<{ parcelId?: string; proposalTripId?: string }>();
  const parcelId = typeof params.parcelId === "string" ? params.parcelId : undefined;
  const proposalTripId = typeof params.proposalTripId === "string" ? params.proposalTripId : undefined;
  const isEditMode = Boolean(parcelId);
  const isProposalMode = Boolean(proposalTripId && !isEditMode);

  const createParcel = useMutation(api.parcels.create);
  const updateParcel = useMutation(api.parcels.update);
  const generateUploadUrl = useMutation(api.parcels.generateUploadUrl);
  const recomputeMatches = useMutation(api.matches.recomputeForParcel);
  const parcelToEdit = useQuery(api.parcels.getById, parcelId ? { parcelId: parcelId as any } : "skip");
  const proposalTrip = useQuery(api.trips.getById, proposalTripId ? { tripId: proposalTripId as any } : "skip");

  const [step, setStep] = useState(1);
  const [originAddress, setOriginAddress] = useState<GeocodedAddress | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<GeocodedAddress | null>(null);
  const [parcelDropoffAddress, setParcelDropoffAddress] = useState<GeocodedAddress | null>(null);
  const [size, setSize] = useState<"petit" | "moyen" | "grand">("petit");
  const [weight, setWeight] = useState("2");
  const [volumeDm3, setVolumeDm3] = useState("12");
  const [description, setDescription] = useState("");
  const [phonePrefix, setPhonePrefix] = useState<PhonePrefix>(PHONE_PREFIXES[0]);
  const [showPrefixPicker, setShowPrefixPicker] = useState(false);
  const [recipientPhoneLocal, setRecipientPhoneLocal] = useState("");
  const [proposedPrice, setProposedPrice] = useState("");
  const [parcelPhotoStorageId, setParcelPhotoStorageId] = useState<string | null>(null);
  const [parcelPhotoPreviewUri, setParcelPhotoPreviewUri] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [shippingDate, setShippingDate] = useState("");
  const [shippingSlot, setShippingSlot] = useState<SlotKey>("afternoon");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [proposalDefaultsApplied, setProposalDefaultsApplied] = useState(false);

  const resetForm = () => {
    setOriginAddress(null);
    setDestinationAddress(null);
    setParcelDropoffAddress(null);
    setSize("petit");
    setWeight("2");
    setVolumeDm3("12");
    setDescription("");
    setPhonePrefix(PHONE_PREFIXES[0]);
    setRecipientPhoneLocal("");
    setProposedPrice("");
    setParcelPhotoStorageId(null);
    setParcelPhotoPreviewUri(null);
    setIsUploadingPhoto(false);
    setShippingDate("");
    setShippingSlot("afternoon");
    setStep(1);
    setShowAdvanced(false);
  };

  const canEditParcel = useMemo(() => {
    if (!parcelToEdit) return false;
    return parcelToEdit.ownerVisitorId === userId;
  }, [parcelToEdit, userId]);

  const proposalRouteBounds = useMemo(() => {
    if (!proposalTrip) return null;
    if (!hasValidLatLng(proposalTrip.originAddress) || !hasValidLatLng(proposalTrip.destinationAddress)) {
      return null;
    }
    return {
      origin: { lat: proposalTrip.originAddress.lat, lng: proposalTrip.originAddress.lng },
      destination: { lat: proposalTrip.destinationAddress.lat, lng: proposalTrip.destinationAddress.lng },
    };
  }, [proposalTrip]);

  const proposalDetour = useMemo(() => {
    const dropoff = isProposalMode ? parcelDropoffAddress : destinationAddress;
    if (!isProposalMode || !proposalTrip || !proposalRouteBounds || !originAddress || !dropoff) {
      return null;
    }

    const pickupToRoute = distancePointToSegmentKm(
      { lat: originAddress.lat, lng: originAddress.lng },
      proposalRouteBounds.origin,
      proposalRouteBounds.destination
    );
    const dropToRoute = distancePointToSegmentKm(
      { lat: dropoff.lat, lng: dropoff.lng },
      proposalRouteBounds.origin,
      proposalRouteBounds.destination
    );

    const detourDistanceKm = (pickupToRoute + dropToRoute) * 1.4;
    const detourMinutes = (detourDistanceKm / 45) * 60;
    const pickupProgress = projectProgressOnSegment(
      { lat: originAddress.lat, lng: originAddress.lng },
      proposalRouteBounds.origin,
      proposalRouteBounds.destination
    );
    const dropProgress = projectProgressOnSegment(
      { lat: dropoff.lat, lng: dropoff.lng },
      proposalRouteBounds.origin,
      proposalRouteBounds.destination
    );

    return {
      detourDistanceKm: Math.round(detourDistanceKm * 100) / 100,
      detourMinutes: Math.round(detourMinutes),
      pickupProgress,
      dropProgress,
      isDropAfterPickup: dropProgress + 0.03 >= pickupProgress,
    };
  }, [destinationAddress, isProposalMode, originAddress, parcelDropoffAddress, proposalRouteBounds, proposalTrip]);

  const proposalPriceEstimate = useMemo(() => {
    if (!proposalDetour) return null;
    return computeDynamicPrice({
      baseDistanceKm: proposalDetour.detourDistanceKm,
      weightKg: PROPOSAL_DEFAULT_WEIGHT,
      volumeDm3: PROPOSAL_DEFAULT_VOLUME,
      detourMinutes: proposalDetour.detourMinutes,
      urgencyLevel: "normal",
      fragile: false,
      insuranceValue: undefined,
    });
  }, [proposalDetour]);

  const exceedsTripDetour = Boolean(
    isProposalMode &&
      proposalTrip &&
      proposalDetour &&
      Number.isFinite(proposalTrip.maxDetourMinutes) &&
      proposalDetour.detourMinutes > proposalTrip.maxDetourMinutes + 5
  );

  useEffect(() => {
    if (!parcelToEdit || !canEditParcel) return;
    setOriginAddress(parcelToEdit.originAddress as GeocodedAddress);
    setDestinationAddress(parcelToEdit.destinationAddress as GeocodedAddress);
    setSize(parcelToEdit.size);
    setWeight(String(parcelToEdit.weight));
    setVolumeDm3(String(parcelToEdit.volumeDm3));
    setDescription(parcelToEdit.description);
    setProposedPrice(parcelToEdit.proposedPrice ? String(parcelToEdit.proposedPrice) : "");
    setParcelPhotoStorageId(parcelToEdit.parcelPhotoId ? String(parcelToEdit.parcelPhotoId) : null);
    setParcelPhotoPreviewUri(parcelToEdit.parcelPhotoUrl ?? null);
    const rawPhone = parcelToEdit.recipientPhone ?? "";
    const matchedPrefix = PHONE_PREFIXES.find((entry) => rawPhone.startsWith(entry.code));
    if (matchedPrefix) {
      setPhonePrefix(matchedPrefix);
      setRecipientPhoneLocal(toLocalPhone(matchedPrefix.code, rawPhone));
    } else {
      setRecipientPhoneLocal(onlyDigits(rawPhone));
    }

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

  useEffect(() => {
    setProposalDefaultsApplied(false);
  }, [proposalTripId]);

  useEffect(() => {
    if (isEditMode || proposalDefaultsApplied || !proposalTrip || !proposalRouteBounds) {
      return;
    }
    setOriginAddress((current) => current ?? (proposalTrip.originAddress as GeocodedAddress));
    setDestinationAddress((current) => current ?? (proposalTrip.destinationAddress as GeocodedAddress));
    setProposalDefaultsApplied(true);
  }, [isEditMode, proposalDefaultsApplied, proposalRouteBounds, proposalTrip]);

  useEffect(() => {
    if (!isProposalMode || proposalTrip === undefined) {
      return;
    }
    if (!proposalTrip || proposalTrip.status !== "published") {
      Alert.alert("Trajet indisponible", "Ce trajet n'est plus disponible. Lancez une nouvelle recherche.");
      router.replace("/search/results" as any);
    }
  }, [isProposalMode, proposalTrip]);

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
    if (isProposalMode) return true;
    if (value === 1 && (!originAddress || !destinationAddress)) {
      Alert.alert("Itineraire incomplet", "Ajoutez depart et arrivee.");
      return false;
    }
    const localPhone = onlyDigits(recipientPhoneLocal);
    if (value === 1 && !/^\d{10}$/.test(localPhone)) {
      Alert.alert("Numero invalide", "Saisissez 10 chiffres puis verifiez l indicatif pays.");
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
    const effectiveDestinationAddress = isProposalMode ? parcelDropoffAddress : destinationAddress;

    if (!originAddress || !effectiveDestinationAddress) {
      Alert.alert("Champs requis", "Selectionnez l adresse de depart et l adresse d arrivee.");
      return;
    }

    const localPhone = onlyDigits(recipientPhoneLocal);
    if (!/^\d{10}$/.test(localPhone)) {
      Alert.alert("Numero destinataire invalide", "Saisissez 10 chiffres (format xxxxxxxxxx).");
      return;
    }

    const normalizedRecipientPhone = toInternationalPhone(phonePrefix.code, localPhone);
    if (!/^\+[1-9]\d{7,14}$/.test(normalizedRecipientPhone)) {
      Alert.alert(
        "Numero destinataire invalide",
        "Format impossible a convertir. Verifiez l indicatif pays et le numero."
      );
      return;
    }

    const weightNum = isProposalMode ? PROPOSAL_DEFAULT_WEIGHT : Number(weight);
    const volumeNum = isProposalMode ? PROPOSAL_DEFAULT_VOLUME : Number(volumeDm3);
    if (!Number.isFinite(weightNum) || weightNum <= 0 || !Number.isFinite(volumeNum) || volumeNum <= 0) {
      Alert.alert("Dimensions invalides", "Renseignez un poids et un volume valides.");
      return;
    }

    if (isProposalMode) {
      if (!proposalTrip) {
        Alert.alert("Trajet indisponible", "Le trajet cible est introuvable ou n est plus disponible.");
        return;
      }
      if (!proposalRouteBounds) {
        Alert.alert("Trajet incomplet", "Ce trajet ne contient pas assez de donnees geographiques pour calculer une deviation.");
        return;
      }
      if (!proposalDetour || !proposalDetour.isDropAfterPickup) {
        Alert.alert("Itineraire incompatible", "Le depot doit se situer apres le point de picking sur le trajet choisi.");
        return;
      }
      if (exceedsTripDetour) {
        Alert.alert("Deviation trop elevee", "Ce colis depasse la deviation max acceptee pour ce trajet.");
        return;
      }
    }

    const priceValue = isProposalMode
      ? proposalPriceEstimate?.totalAmount ?? 0
      : Number(proposedPrice);
    if (!isProposalMode && proposedPrice.trim() && (!Number.isFinite(priceValue) || priceValue <= 0)) {
      Alert.alert("Prix invalide", "Saisissez un prix propose valide ou laissez vide.");
      return;
    }

    const timeWindow = isProposalMode
      ? proposalTrip
        ? {
            windowStartTs: proposalTrip.windowStartTs,
            windowEndTs: proposalTrip.windowEndTs,
          }
        : null
      : buildWindowTimestamps(shippingDate, shippingSlot);
    if (!timeWindow) {
      Alert.alert(
        isProposalMode ? "Trajet indisponible" : "Date invalide",
        isProposalMode
          ? "Le trajet cible n est plus disponible."
          : "Choisissez une date au format JJ/MM/AAAA puis un creneau (matin/apres-midi/soiree)."
      );
      return;
    }

    try {
      const trimmedDescription = description.trim() || "Colis sans description";
      const payload = {
        ownerVisitorId: userId,
        originAddress,
        destinationAddress: effectiveDestinationAddress,
        size: isProposalMode ? PROPOSAL_DEFAULT_SIZE : size,
        weight: weightNum,
        volumeDm3: volumeNum,
        description: isProposalMode
          ? trimmedDescription || "Proposition de colis sur trajet existant"
          : trimmedDescription,
        fragile: false,
        urgencyLevel: "normal" as const,
        insuranceValue: undefined,
        proposedPrice: Number.isFinite(priceValue) && priceValue > 0 ? priceValue : undefined,
        preferredWindowStartTs: timeWindow.windowStartTs,
        preferredWindowEndTs: timeWindow.windowEndTs,
        phone: undefined,
        recipientPhone: normalizedRecipientPhone,
        parcelPhotoId: parcelPhotoStorageId ? (parcelPhotoStorageId as any) : undefined,
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
        if (proposalTripId) {
          Alert.alert("Demande envoyee", "Votre colis a ete publie et transmis aux transporteurs compatibles.");
        }
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
        nestedScrollEnabled
        scrollEventThrottle={16}
      >
        <BackButton
          label={step === 1 ? "Retour" : "Etape precedente"}
          onPress={() =>
            step === 1
              ? router.canGoBack()
                ? router.back()
                : router.replace("/(tabs)" as any)
              : setStep((prev) => prev - 1)
          }
        />

        <Text style={styles.header}>
          {isEditMode ? "Modifier mon colis" : isProposalMode ? "Proposer un colis" : "Publier un colis"}
        </Text>

        {proposalTrip && !isEditMode ? (
          <View style={styles.proposalBanner}>
            <Ionicons name="paper-plane-outline" size={16} color={Colors.dark.info} />
            <View style={styles.proposalBannerContent}>
             <Text style={styles.proposalBannerTitle}>Proposition liee a un trajet selectionne</Text>
              <Text style={styles.proposalBannerText} numberOfLines={2}>
                {proposalTrip.origin} {" -> "} {proposalTrip.destination}
              </Text>
            </View>
          </View>
        ) : null}

        {!isProposalMode ? (
          <>
            <Text style={styles.progressLabel}>Etape {step}/{TOTAL_STEPS}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressBar, { width: `${progress}%` }]} />
            </View>
          </>
        ) : null}

        {isProposalMode ? (
          <>
            <Text style={styles.stepTitle}>Proposition rapide</Text>
            <AddressAutocompleteInput
              label="Adresse de picking"
              placeholder="Ou recuperer le colis"
              value={originAddress}
              onChange={setOriginAddress}
              enableCurrentLocation
            />
            <Text style={styles.label}>Adresse de destination du trajet</Text>
            <View style={styles.readonlyCard}>
              <Text style={styles.readonlyText}>{proposalTrip?.destination ?? "-"}</Text>
            </View>
            <AddressAutocompleteInput
              label="Adresse de depot du colis"
              placeholder="Ou livrer le colis"
              value={parcelDropoffAddress}
              onChange={setParcelDropoffAddress}
            />

            <Text style={styles.label}>Numero du destinataire (SMS QR)</Text>
            <View style={styles.phoneRow}>
              <TouchableOpacity style={styles.prefixButton} onPress={() => setShowPrefixPicker(true)}>
                <Text style={styles.prefixButtonText}>{phonePrefix.flag} {phonePrefix.code}</Text>
                <Ionicons name="chevron-down" size={14} color={Colors.dark.textSecondary} />
              </TouchableOpacity>
              <TextInput
                style={[styles.input, styles.phoneInput]}
                value={recipientPhoneLocal}
                onChangeText={(value) => setRecipientPhoneLocal(onlyDigits(value).slice(0, 10))}
                keyboardType="number-pad"
                autoCapitalize="none"
                placeholder="xxxxxxxxxx"
                placeholderTextColor={Colors.dark.textSecondary}
              />
            </View>

            <View style={styles.proposalSummaryCard}>
              <Text style={styles.proposalSummaryTitle}>Estimation pour ce trajet</Text>
              <Text style={styles.proposalSummaryLine}>
                Deviation: {proposalDetour ? `${proposalDetour.detourMinutes} min (${proposalDetour.detourDistanceKm} km)` : "-"}
              </Text>
              {proposalTrip ? (
                <Text style={styles.proposalSummaryLine}>
                  Limite transporteur: {Number.isFinite(proposalTrip.maxDetourMinutes) ? `${proposalTrip.maxDetourMinutes} min` : "-"}
                </Text>
              ) : null}
              <Text style={styles.proposalSummaryPrice}>
                Prix total estime: {proposalPriceEstimate ? `${proposalPriceEstimate.totalAmount} EUR` : "-"}
              </Text>
              {proposalDetour && !proposalDetour.isDropAfterPickup ? (
                <Text style={styles.proposalWarning}>Le depot doit etre apres le point de picking sur le trajet.</Text>
              ) : null}
              {exceedsTripDetour ? (
                <Text style={styles.proposalWarning}>Cette proposition depasse la deviation max autorisee.</Text>
              ) : null}
            </View>

            <ActionButton
              label="Envoyer la demande"
              style={styles.button}
              iconLeft={<Ionicons name="paper-plane-outline" size={18} color={Colors.dark.text} />}
              onPress={() => void handlePublish()}
            />

            <ActionButton
              label="Nouvelle recherche"
              size="sm"
              variant="secondary"
              style={styles.resetSearchButton}
              onPress={() =>
                void (async () => {
                  await newSearch();
                  router.replace("/(tabs)" as any);
                })()
              }
            />
          </>
        ) : null}

        {!isProposalMode && step === 1 ? (
          <>
            <Text style={styles.stepTitle}>Itineraire</Text>
            <AddressAutocompleteInput
              label="Adresse depart"
              placeholder="Saisissez puis choisissez"
              value={originAddress}
              onChange={setOriginAddress}
              enableCurrentLocation
            />
            <AddressAutocompleteInput
              label="Adresse arrivee"
              placeholder="Saisissez puis choisissez"
              value={destinationAddress}
              onChange={setDestinationAddress}
            />

            <Text style={styles.label}>Numero du destinataire (SMS QR)</Text>
            <View style={styles.phoneRow}>
              <TouchableOpacity style={styles.prefixButton} onPress={() => setShowPrefixPicker(true)}>
                <Text style={styles.prefixButtonText}>{phonePrefix.flag} {phonePrefix.code}</Text>
                <Ionicons name="chevron-down" size={14} color={Colors.dark.textSecondary} />
              </TouchableOpacity>
              <TextInput
                style={[styles.input, styles.phoneInput]}
                value={recipientPhoneLocal}
                onChangeText={(value) => setRecipientPhoneLocal(onlyDigits(value).slice(0, 10))}
                keyboardType="number-pad"
                autoCapitalize="none"
                placeholder="xxxxxxxxxx"
                placeholderTextColor={Colors.dark.textSecondary}
              />
            </View>
          </>
        ) : null}

        {!isProposalMode && step === 2 ? (
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

        {!isProposalMode && step === 3 ? (
          <>
            <Text style={styles.stepTitle}>Taille et poids</Text>
            <Text style={styles.label}>Taille</Text>
            <View style={styles.row}>
              {(["petit", "moyen", "grand"] as const).map((value) => (
                <ChoiceChip
                  key={value}
                  label={value}
                  active={size === value}
                  onPress={() => setSize(value)}
                />
              ))}
            </View>

            <Text style={styles.label}>Poids (kg)</Text>
            <TextInput value={weight} onChangeText={setWeight} style={styles.input} keyboardType="numeric" />

            <Text style={styles.label}>Description du colis</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Contenu, fragilite, instructions..."
              placeholderTextColor={Colors.dark.textSecondary}
              multiline
            />

            <Text style={styles.label}>Prix propose (EUR, optionnel)</Text>
            <TextInput
              value={proposedPrice}
              onChangeText={setProposedPrice}
              style={styles.input}
              keyboardType="numeric"
              placeholder="Ex: 25"
              placeholderTextColor={Colors.dark.textSecondary}
            />

            <Text style={styles.label}>Photo du colis (optionnel)</Text>
            <View style={styles.photoActionsRow}>
              <TouchableOpacity
                style={[styles.photoActionButton, isUploadingPhoto && styles.photoActionButtonDisabled]}
                disabled={isUploadingPhoto}
                onPress={async () => {
                  try {
                    const uri = await pickImage([4, 3]);
                    if (!uri) return;
                    setIsUploadingPhoto(true);
                    setParcelPhotoPreviewUri(uri);
                    const storageId = await uploadToConvex(uri, generateUploadUrl);
                    setParcelPhotoStorageId(storageId);
                  } catch {
                    Alert.alert("Erreur", "Impossible d envoyer la photo du colis.");
                  } finally {
                    setIsUploadingPhoto(false);
                  }
                }}
              >
                <Ionicons name="images-outline" size={14} color={Colors.dark.text} />
                <Text style={styles.photoActionText}>Galerie</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.photoActionButton, isUploadingPhoto && styles.photoActionButtonDisabled]}
                disabled={isUploadingPhoto}
                onPress={async () => {
                  try {
                    const uri = await takePhoto([4, 3]);
                    if (!uri) return;
                    setIsUploadingPhoto(true);
                    setParcelPhotoPreviewUri(uri);
                    const storageId = await uploadToConvex(uri, generateUploadUrl);
                    setParcelPhotoStorageId(storageId);
                  } catch {
                    Alert.alert("Erreur", "Impossible de prendre ou envoyer la photo.");
                  } finally {
                    setIsUploadingPhoto(false);
                  }
                }}
              >
                <Ionicons name="camera-outline" size={14} color={Colors.dark.text} />
                <Text style={styles.photoActionText}>Camera</Text>
              </TouchableOpacity>
            </View>

            {isUploadingPhoto ? (
              <View style={styles.photoUploadingRow}>
                <ActivityIndicator color={Colors.dark.primary} size="small" />
                <Text style={styles.photoUploadingText}>Envoi de la photo...</Text>
              </View>
            ) : null}

            {parcelPhotoPreviewUri ? (
              <View style={styles.photoPreviewWrap}>
                <Image source={{ uri: parcelPhotoPreviewUri }} style={styles.photoPreview} />
                <TouchableOpacity
                  style={styles.photoRemoveButton}
                  onPress={() => {
                    setParcelPhotoStorageId(null);
                    setParcelPhotoPreviewUri(null);
                  }}
                >
                  <Ionicons name="close" size={14} color={Colors.dark.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : null}

            <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvanced((prev) => !prev)}>
              <Text style={styles.advancedToggleText}>{showAdvanced ? "Masquer options avancees" : "Afficher options avancees"}</Text>
            </TouchableOpacity>

            {showAdvanced ? (
              <>
                <Text style={styles.label}>Volume (dm3)</Text>
                <TextInput value={volumeDm3} onChangeText={setVolumeDm3} style={styles.input} keyboardType="numeric" />
              </>
            ) : null}
          </>
        ) : null}

        {!isProposalMode && step === 4 ? (
          <>
            <Text style={styles.stepTitle}>Verification</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLine}>Itineraire: {originAddress?.label ?? "-"}{" -> "}{destinationAddress?.label ?? "-"}</Text>
              <Text style={styles.summaryLine}>Destinataire: {recipientPhoneLocal ? `${phonePrefix.code} ${recipientPhoneLocal}` : "-"}</Text>
              <Text style={styles.summaryLine}>Date: {shippingDate || "-"}</Text>
              <Text style={styles.summaryLine}>Creneau: {shippingSlot}</Text>
              <Text style={styles.summaryLine}>Taille: {size}</Text>
              <Text style={styles.summaryLine}>Poids: {weight} kg</Text>
              <Text style={styles.summaryLine}>Prix propose: {proposedPrice || "-"}</Text>
              <Text style={styles.summaryLine}>Photo: {parcelPhotoPreviewUri ? "Ajoutee" : "-"}</Text>
            </View>
          </>
        ) : null}

        {!isProposalMode && step < TOTAL_STEPS ? (
          <ActionButton
            label="Continuer"
            style={styles.button}
            onPress={() => {
              if (!validateStep(step)) return;
              setStep((prev) => prev + 1);
            }}
          />
        ) : !isProposalMode ? (
          <ActionButton
            label={isEditMode ? "Mettre a jour" : proposalTripId ? "Envoyer la demande" : "Publier"}
            style={styles.button}
            iconLeft={<Ionicons name="cube" size={18} color={Colors.dark.text} />}
            onPress={() => void handlePublish()}
          />
        ) : null}
      </ScrollView>

      <Modal visible={showPrefixPicker} transparent animationType="fade" onRequestClose={() => setShowPrefixPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choisir un indicatif</Text>
            {PHONE_PREFIXES.map((entry) => (
              <TouchableOpacity
                key={entry.code}
                style={styles.modalOption}
                onPress={() => {
                  setPhonePrefix(entry);
                  setShowPrefixPicker(false);
                }}
              >
                <Text style={styles.modalOptionText}>{entry.flag} {entry.label}</Text>
                <Text style={styles.modalOptionCode}>{entry.code}</Text>
              </TouchableOpacity>
            ))}
            <ActionButton label="Fermer" size="sm" style={styles.modalCloseButton} onPress={() => setShowPrefixPicker(false)} />
          </View>
        </View>
      </Modal>
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
    height: 3,
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
  readonlyCard: {
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readonlyText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Fonts.sans,
  },
  input: {
    backgroundColor: Colors.dark.surfaceMuted,
    borderColor: Colors.dark.border,
    borderWidth: 0,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.dark.text,
    fontSize: 15,
    fontFamily: Fonts.sans,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  prefixButton: {
    minWidth: 110,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  prefixButtonText: {
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  phoneInput: {
    flex: 1,
  },
  proposalBanner: {
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: "rgba(37, 99, 235, 0.11)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  proposalBannerContent: {
    flex: 1,
    gap: 1,
  },
  proposalBannerTitle: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  proposalBannerText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  photoActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
    flexWrap: "wrap",
  },
  photoActionButton: {
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingVertical: 9,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  photoActionButtonDisabled: {
    opacity: 0.55,
  },
  photoActionText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  photoUploadingRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  photoUploadingText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  photoPreviewWrap: {
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 0,
    position: "relative",
    backgroundColor: Colors.dark.surfaceMuted,
  },
  photoPreview: {
    width: "100%",
    height: 180,
  },
  photoRemoveButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 14, 20, 0.78)",
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 8 },
  advancedToggle: { marginTop: 10, alignSelf: "flex-start" },
  advancedToggleText: { color: Colors.dark.primary, fontSize: 13, fontFamily: Fonts.sansSemiBold },
  button: { marginTop: 20 },
  resetSearchButton: { marginTop: 10 },
  summaryCard: {
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: Colors.dark.surface,
    padding: 12,
    gap: 6,
  },
  summaryLine: { fontSize: 13, color: Colors.dark.textSecondary, fontFamily: Fonts.sans },
  proposalSummaryCard: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: Colors.dark.surface,
    padding: 12,
    gap: 6,
  },
  proposalSummaryTitle: {
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  proposalSummaryLine: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
  proposalSummaryPrice: {
    marginTop: 2,
    color: Colors.dark.success,
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  proposalWarning: {
    color: Colors.dark.error,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 16, color: Colors.dark.text, textAlign: "center", fontFamily: Fonts.displaySemiBold },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  modalCard: {
    borderRadius: 12,
    borderWidth: 0,
    backgroundColor: Colors.dark.surface,
    padding: 14,
    gap: 8,
  },
  modalTitle: {
    color: Colors.dark.text,
    fontSize: 15,
    fontFamily: Fonts.sansSemiBold,
    marginBottom: 2,
  },
  modalOption: {
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalOptionText: {
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  modalOptionCode: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
  modalCloseButton: {
    marginTop: 6,
    alignSelf: "stretch",
  },
});
