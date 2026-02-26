import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Colors } from "@/constants/theme";

type SurfaceCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function SurfaceCard({ children, style }: SurfaceCardProps) {
  return <View style={[baseStyle, style]}>{children}</View>;
}

const baseStyle = {
  borderRadius: 12,
  backgroundColor: Colors.dark.surface,
  padding: 12,
};
