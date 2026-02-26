import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AddressAutocompleteInput } from "@/components/maps/AddressAutocompleteInput";
import { buildDayWindowTimestamps } from "@/components/forms/TimeWindowInput";
import { ColibLogoMark } from "@/components/branding/ColibLogoMark";
import { Colors, Fonts } from "@/constants/theme";
import { FILTER_STORAGE_KEY, LAST_SEARCH_STORAGE_KEY } from "@/constants/searchFlow";
import { useSearchFlow, type PersistedSearch } from "@/context/SearchFlowContext";
import { useUser } from "@/context/UserContext";
import { getPersistedItem, getSessionItem, setPersistedItem, setSessionItem } from "@/utils/clientStorage";
import type { GeocodedAddress } from "@/packages/shared/maps";

export default function TripsScreen() {
  const { beginSearch } = useSearchFlow();
  const { isLoggedIn } = useUser();

  const [originZone, setOriginZone] = useState<GeocodedAddress | null>(null);
  const [destinationZone, setDestinationZone] = useState<GeocodedAddress | null>(null);
  const [dateValue, setDateValue] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isHydratingFilters, setIsHydratingFilters] = useState(true);
  const [lastSearch, setLastSearch] = useState<PersistedSearch | null>(null);

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      try {
        const persistedFilters = await getPersistedItem(FILTER_STORAGE_KEY);
        if (persistedFilters && mounted) {
          const parsed = JSON.parse(persistedFilters) as Partial<PersistedSearch>;
          setOriginZone(parsed.originZone ?? null);
          setDestinationZone(parsed.destinationZone ?? null);
          setDateValue(parsed.dateValue ?? "");
          setShowAdvancedFilters(Boolean(parsed.showAdvancedFilters || parsed.originZone || parsed.dateValue));
        }

        const persistedSessionSearch = getSessionItem(LAST_SEARCH_STORAGE_KEY);
        const persistedSearch = persistedSessionSearch ?? (await getPersistedItem(LAST_SEARCH_STORAGE_KEY));
        if (persistedSearch && mounted) {
          setLastSearch(JSON.parse(persistedSearch) as PersistedSearch);
        }
      } catch {
        if (!mounted) return;
      } finally {
        if (mounted) setIsHydratingFilters(false);
      }
    };

    void hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  const launchSearch = async (payload: {
    originZone: GeocodedAddress | null;
    destinationZone: GeocodedAddress | null;
    dateValue: string;
    showAdvancedFilters: boolean;
  }) => {
    if (!isLoggedIn) {
      Alert.alert("Connexion requise", "Inscrivez-vous ou connectez-vous pour lancer une recherche de trajets.");
      return;
    }

    const { originZone: nextOrigin, destinationZone: nextDestination, dateValue: nextDate, showAdvancedFilters: nextShowAdvanced } = payload;

    if (!nextDestination) {
      Alert.alert("Destination requise", "Ajoutez une zone d'arrivee pour lancer la recherche.");
      return;
    }

    const normalizedDate = nextDate.trim();
    if (normalizedDate && !buildDayWindowTimestamps(normalizedDate)) {
      Alert.alert("Date invalide", "Utilisez le format JJ/MM/AAAA ou laissez vide.");
      return;
    }

    beginSearch({
      originZone: nextOrigin,
      destinationZone: nextDestination,
      dateValue: normalizedDate,
      showAdvancedFilters: nextShowAdvanced,
    });

    const persistedPayload: PersistedSearch = {
      originZone: nextOrigin,
      destinationZone: nextDestination,
      dateValue: normalizedDate,
      showAdvancedFilters: nextShowAdvanced,
      searchedAt: Date.now(),
      resultCount: lastSearch?.resultCount ?? 0,
    };

    setLastSearch(persistedPayload);
    await setPersistedItem(FILTER_STORAGE_KEY, JSON.stringify(persistedPayload));
    await setPersistedItem(LAST_SEARCH_STORAGE_KEY, JSON.stringify(persistedPayload));
    setSessionItem(LAST_SEARCH_STORAGE_KEY, JSON.stringify(persistedPayload));
    router.push("/search/matching" as any);
  };

  const handleRelaunchSearch = async () => {
    if (!lastSearch) return;
    setOriginZone(lastSearch.originZone);
    setDestinationZone(lastSearch.destinationZone);
    setDateValue(lastSearch.dateValue);
    setShowAdvancedFilters(lastSearch.showAdvancedFilters);
    await launchSearch({
      originZone: lastSearch.originZone,
      destinationZone: lastSearch.destinationZone,
      dateValue: lastSearch.dateValue,
      showAdvancedFilters: lastSearch.showAdvancedFilters,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoWrap}>
            <ColibLogoMark size={44} color="#EAF0F6" backgroundColor="#161D24" />
          </View>
          <View style={styles.brandTextWrap}>
            <Text style={styles.title}>Colib</Text>
            <Text style={styles.tagline}>transportez où vous voulez, quand vous voulez.</Text>
          </View>
        </View>
      </View>

      <View style={styles.searchContainerWrap}>
        <View style={styles.searchContainer}>
          <AddressAutocompleteInput
            label="Destination"
            placeholder="Ville ou adresse d'arrivee"
            value={destinationZone}
            onChange={setDestinationZone}
          />

          <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvancedFilters((value) => !value)}>
            <Ionicons name={showAdvancedFilters ? "remove-circle-outline" : "add-circle-outline"} size={16} color={Colors.dark.primary} />
            <Text style={styles.advancedToggleText}>{showAdvancedFilters ? "Masquer les filtres" : "Ajouter des filtres"}</Text>
          </TouchableOpacity>

          {showAdvancedFilters ? (
            <>
              <AddressAutocompleteInput
                label="Zone de depart (optionnel)"
                placeholder="Ville ou adresse de depart"
                value={originZone}
                onChange={setOriginZone}
                enableCurrentLocation
              />
              <Text style={styles.inputLabel}>Date (optionnelle)</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="JJ/MM/AAAA"
                placeholderTextColor={Colors.dark.textSecondary}
                value={dateValue}
                onChangeText={setDateValue}
              />
            </>
          ) : null}

          <TouchableOpacity
            style={[styles.searchButton, !isLoggedIn && styles.searchButtonDisabled]}
            onPress={() =>
              void launchSearch({
                originZone,
                destinationZone,
                dateValue,
                showAdvancedFilters,
              })
            }
            activeOpacity={0.9}
            disabled={isHydratingFilters || !isLoggedIn}
          >
            <Text style={styles.searchButtonText}>Rechercher des trajets</Text>
          </TouchableOpacity>

          {lastSearch ? (
            <TouchableOpacity style={styles.relaunchButton} onPress={() => void handleRelaunchSearch()} activeOpacity={0.9}>
              <Ionicons name="refresh-outline" size={14} color={Colors.dark.text} />
              <Text style={styles.relaunchButtonText}>Relancer la derniere recherche</Text>
            </TouchableOpacity>
          ) : null}

          {!isLoggedIn ? (
            <TouchableOpacity
              style={styles.signupCtaButton}
              onPress={() => router.push("/(tabs)/profile" as any)}
              activeOpacity={0.9}
            >
              <Text style={styles.signupCtaButtonText}>Inscrivez-vous pour trouver un trajet</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 66,
    paddingBottom: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  brandRow: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  brandTextWrap: {
    alignItems: "center",
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.dark.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    color: Colors.dark.text,
    fontFamily: Fonts.displaySemiBold,
    textAlign: "center",
  },
  tagline: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sans,
    textTransform: "none",
    textAlign: "center",
  },
  searchContainerWrap: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 24,
  },
  searchContainer: {
    width: "100%",
    maxWidth: 680,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    gap: 12,
  },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  advancedToggleText: {
    color: Colors.dark.primary,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  inputLabel: {
    marginTop: -2,
    marginBottom: -4,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
  },
  searchInput: {
    backgroundColor: Colors.dark.surfaceMuted,
    borderRadius: 12,
    borderColor: Colors.dark.border,
    borderWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.dark.text,
    fontFamily: Fonts.sans,
  },
  searchButton: {
    marginTop: 2,
    backgroundColor: Colors.dark.secondary,
    borderRadius: 12,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  searchButtonText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  searchButtonDisabled: {
    opacity: 0.55,
  },
  relaunchButton: {
    marginTop: -4,
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  relaunchButtonText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  signupCtaButton: {
    marginTop: -2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primaryLight,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  signupCtaButtonText: {
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
});
