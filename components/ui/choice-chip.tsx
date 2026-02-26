import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { Colors, Fonts } from "@/constants/theme";

type ChoiceChipProps = {
  label: string;
  active?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ChoiceChip({ label, active = false, onPress, style }: ChoiceChipProps) {
  return (
    <Pressable style={[styles.base, active && styles.active, style]} onPress={onPress}>
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: Colors.dark.surfaceMuted,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  active: {
    backgroundColor: Colors.dark.primary,
  },
  text: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
  },
  textActive: {
    color: Colors.dark.text,
  },
});
