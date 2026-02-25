import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors, Fonts } from "@/constants/theme";

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
    backgroundColor: Colors.dark.primaryLight,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  chipText: {
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  chipTextActive: {
    color: Colors.dark.text,
  },
});
