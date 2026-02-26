import { Text, TouchableOpacity, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";

type BackButtonProps = {
  label?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function BackButton({ label = "Retour", onPress, style }: BackButtonProps) {
  return (
    <TouchableOpacity style={[baseStyle, style]} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name="arrow-back" size={16} color={Colors.dark.textSecondary} />
      <Text style={labelStyle}>{label}</Text>
    </TouchableOpacity>
  );
}

const baseStyle = {
  alignSelf: "flex-start" as const,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 6,
  borderRadius: 999,
  paddingVertical: 6,
  paddingHorizontal: 10,
  marginBottom: 8,
  backgroundColor: Colors.dark.surface,
};

const labelStyle = {
  fontSize: 12,
  color: Colors.dark.textSecondary,
  fontFamily: Fonts.sansSemiBold,
};
