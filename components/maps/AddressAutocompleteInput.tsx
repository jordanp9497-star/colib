import { useState } from "react";
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

interface Props {
  label: string;
  value: GeocodedAddress | null;
  onChange: (value: GeocodedAddress | null) => void;
  placeholder: string;
}

export function AddressAutocompleteInput({ label, value, onChange, placeholder }: Props) {
  const [input, setInput] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const { suggestions, loading, error, resolveSuggestion } = useAddressAutocomplete(input);
  const hasValue = input.trim().length > 0;

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={input}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
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
          <ActivityIndicator color="#6366F1" size="small" />
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
                setInput(geocoded.label);
                setOpen(false);
              }}
            >
              <Text style={styles.suggestionMain}>{item.mainText}</Text>
              {item.secondaryText ? (
                <Text style={styles.suggestionSecondary}>{item.secondaryText}</Text>
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
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingRight: 46,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1E293B",
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
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 14,
  },
  selectedHint: {
    marginTop: 6,
    color: "#166534",
    fontSize: 12,
    fontWeight: "600",
  },
  suggestionBox: {
    marginTop: 4,
    borderRadius: 10,
    borderColor: "#E2E8F0",
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    maxHeight: 180,
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomColor: "#F1F5F9",
    borderBottomWidth: 1,
  },
  suggestionMain: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
  },
  suggestionSecondary: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  metaRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    color: "#64748B",
    fontSize: 12,
  },
  errorText: {
    color: "#B91C1C",
    marginTop: 6,
    fontSize: 12,
  },
});
