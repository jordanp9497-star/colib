import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import type { GeocodedAddress } from "@/packages/shared/maps";
import { useAddressAutocomplete } from "@/hooks/useAddressAutocomplete";
import { formatShortAddress } from "@/utils/address";
import { Colors, Fonts } from "@/constants/theme";

interface Props {
  label: string;
  value: GeocodedAddress | null;
  onChange: (value: GeocodedAddress | null) => void;
  placeholder: string;
  enableCurrentLocation?: boolean;
  onInputChangeText?: (text: string) => void;
}

export function AddressAutocompleteInput({
  label,
  value,
  onChange,
  placeholder,
  enableCurrentLocation = false,
  onInputChangeText,
}: Props) {
  const [input, setInput] = useState(
    value ? formatShortAddress(value, value.label) : ""
  );
  const [open, setOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const { suggestions, loading, error, resolveSuggestion } = useAddressAutocomplete(input);
  const hasValue = input.trim().length > 0;
  const normalizedSelectedLabel = value ? formatShortAddress(value, value.label).trim() : "";
  const hasValidatedValue = Boolean(value && input.trim() === normalizedSelectedLabel);

  const handleCurrentLocationPress = async () => {
    if (isLocating) return;
    setLocationError(null);
    setOpen(false);
    setIsLocating(true);

    try {
      if (Platform.OS === "web") {
        throw new Error("unsupported_on_web");
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationError("Autorisez la localisation pour utiliser Ma position.");
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const reverse = await Location.reverseGeocodeAsync({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
      const first = reverse[0];
      const locationLabel =
        first && (first.street || first.city)
          ? `${first.street ?? ""}${first.street && first.city ? ", " : ""}${first.city ?? ""}`
          : "Ma position";

      const geocoded: GeocodedAddress = {
        placeId: "current-location",
        label: locationLabel,
        city: first?.city ?? undefined,
        postalCode: first?.postalCode ?? undefined,
        countryCode: first?.isoCountryCode ?? undefined,
        lat: current.coords.latitude,
        lng: current.coords.longitude,
      };

      onChange(geocoded);
      setInput(formatShortAddress(geocoded, geocoded.label));
    } catch {
      setLocationError("Impossible de recuperer la position actuelle.");
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    if (!value) return;
    setInput(formatShortAddress(value, value.label));
  }, [value]);

  return (
    <View style={[styles.root, open && styles.rootRaised]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {enableCurrentLocation ? (
          <Pressable
            onPress={() => void handleCurrentLocationPress()}
            style={[styles.currentLocationButton, isLocating && styles.currentLocationButtonDisabled]}
            disabled={isLocating}
          >
            <Text style={styles.currentLocationButtonText}>{isLocating ? "Localisation..." : "Ma position"}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={input}
          placeholder={placeholder}
          placeholderTextColor={Colors.dark.textSecondary}
          onFocus={() => setOpen(input.trim().length > 0)}
          onBlur={() => {
            setTimeout(() => setOpen(false), 120);
          }}
          onChangeText={(text) => {
            setInput(text);
            onInputChangeText?.(text);
            setLocationError(null);
            setOpen(text.trim().length > 0);
          }}
        />
        {hasValue ? (
          <Pressable
            style={styles.clearButton}
            onPress={() => {
              setInput("");
              onChange(null);
              setLocationError(null);
              setOpen(false);
            }}
          >
            <Text style={styles.clearButtonText}>x</Text>
          </Pressable>
        ) : null}

        {open && suggestions.length > 0 ? (
          <ScrollView
            style={styles.suggestionBox}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {suggestions.map((item) => (
              <Pressable
                key={item.placeId}
                style={styles.suggestionRow}
                onPress={async () => {
                  const geocoded = await resolveSuggestion(item);
                  if (!geocoded) return;
                  onChange(geocoded);
                  setInput(formatShortAddress(geocoded, geocoded.label));
                  setOpen(false);
                }}
              >
                <Text style={styles.suggestionMain} numberOfLines={1}>
                  {item.mainText}
                </Text>
                {item.secondaryText ? (
                  <Text style={styles.suggestionSecondary} numberOfLines={1}>
                    {item.secondaryText}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      {hasValidatedValue ? <Text style={styles.selectedHint}>Adresse validee</Text> : null}

      {loading ? (
        <View style={styles.metaRow}>
          <ActivityIndicator color={Colors.dark.primary} size="small" />
          <Text style={styles.metaText}>Recherche adresses...</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: 12 },
  rootRaised: {
    zIndex: 20,
  },
  labelRow: {
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sansSemiBold,
  },
  currentLocationButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  currentLocationButtonDisabled: {
    opacity: 0.7,
  },
  currentLocationButtonText: {
    color: Colors.dark.primary,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  input: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 14,
    paddingRight: 46,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.dark.text,
    fontFamily: Fonts.sans,
  },
  inputWrap: {
    position: "relative",
    zIndex: 30,
  },
  clearButton: {
    position: "absolute",
    right: 10,
    top: 9,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dark.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: {
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
  },
  selectedHint: {
    marginTop: 6,
    color: Colors.dark.success,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  suggestionBox: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    zIndex: 40,
    borderRadius: 10,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    backgroundColor: Colors.dark.surface,
    maxHeight: 180,
    elevation: 10,
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomColor: Colors.dark.border,
    borderBottomWidth: 1,
  },
  suggestionMain: {
    fontSize: 14,
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
  },
  suggestionSecondary: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
    fontFamily: Fonts.sans,
  },
  metaRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  errorText: {
    color: Colors.dark.error,
    marginTop: 6,
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
});
