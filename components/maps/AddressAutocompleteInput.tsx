import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { GeocodedAddress } from "@/packages/shared/maps";
import { useAddressAutocomplete } from "@/hooks/useAddressAutocomplete";
import { formatShortAddress } from "@/utils/address";
import { Colors, Fonts } from "@/constants/theme";

interface Props {
  label: string;
  value: GeocodedAddress | null;
  onChange: (value: GeocodedAddress | null) => void;
  placeholder: string;
}

export function AddressAutocompleteInput({ label, value, onChange, placeholder }: Props) {
  const [input, setInput] = useState(
    value ? formatShortAddress(value, value.label) : ""
  );
  const [open, setOpen] = useState(false);
  const { suggestions, loading, error, resolveSuggestion } = useAddressAutocomplete(input);
  const hasValue = input.trim().length > 0;

  useEffect(() => {
    if (!value) return;
    setInput(formatShortAddress(value, value.label));
  }, [value]);

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={input}
          placeholder={placeholder}
          placeholderTextColor={Colors.dark.textSecondary}
          onFocus={() => setOpen(true)}
          onChangeText={(text) => {
            setInput(text);
            onChange(null);
          }}
        />
        {hasValue ? (
          <Pressable
            style={styles.clearButton}
            onPress={() => {
              setInput("");
              onChange(null);
              setOpen(false);
            }}
          >
            <Text style={styles.clearButtonText}>x</Text>
          </Pressable>
        ) : null}
      </View>

      {value ? <Text style={styles.selectedHint}>Adresse validee</Text> : null}

      {loading ? (
        <View style={styles.metaRow}>
          <ActivityIndicator color={Colors.dark.primary} size="small" />
          <Text style={styles.metaText}>Recherche adresses...</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {open && suggestions.length > 0 ? (
        <View style={styles.suggestionBox}>
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
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: 12 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
    marginBottom: 6,
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
    marginTop: 4,
    borderRadius: 10,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    backgroundColor: Colors.dark.surface,
    maxHeight: 180,
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
