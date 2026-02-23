import { Pressable, StyleSheet, Text, View } from "react-native";

const OPTIONS = [10, 20, 30] as const;

export function DetourFilter({
  value,
  onChange,
}: {
  value: number;
  onChange: (minutes: number) => void;
}) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((minutes) => (
        <Pressable
          key={minutes}
          style={[styles.chip, value === minutes && styles.chipActive]}
          onPress={() => onChange(minutes)}
        >
          <Text style={[styles.chipText, value === minutes && styles.chipTextActive]}>
            {minutes} min
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE",
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: "#4338CA",
    borderColor: "#4338CA",
  },
  chipText: {
    color: "#3730A3",
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
});
