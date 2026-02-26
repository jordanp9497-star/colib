import { StyleSheet, View } from "react-native";
import { ChoiceChip } from "@/components/ui/choice-chip";

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
        <ChoiceChip
          key={minutes}
          label={`${minutes} min`}
          active={value === minutes}
          onPress={() => onChange(minutes)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
  },
});
