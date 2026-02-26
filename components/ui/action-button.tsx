import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from "react-native";
import { Colors, Fonts } from "@/constants/theme";

type ActionVariant = "primary" | "secondary" | "success" | "danger" | "info" | "muted";
type ActionSize = "sm" | "md";

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ActionVariant;
  size?: ActionSize;
  disabled?: boolean;
  loading?: boolean;
  iconLeft?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const VARIANT_STYLES: Record<ActionVariant, { bg: string; text: string }> = {
  primary: { bg: Colors.dark.primary, text: Colors.dark.text },
  secondary: { bg: Colors.dark.surfaceMuted, text: Colors.dark.textSecondary },
  success: { bg: Colors.dark.success, text: Colors.dark.text },
  danger: { bg: Colors.dark.error, text: Colors.dark.text },
  info: { bg: Colors.dark.info, text: Colors.dark.text },
  muted: { bg: Colors.dark.surface, text: Colors.dark.textSecondary },
};

export function ActionButton({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  iconLeft,
  style,
}: ActionButtonProps) {
  const colors = VARIANT_STYLES[variant];
  const compact = size === "sm";

  return (
    <TouchableOpacity
      style={[
        styles.base,
        compact ? styles.small : styles.medium,
        { backgroundColor: colors.bg },
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.86}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <View style={styles.inner}>
          {iconLeft}
          {label ? <Text style={[styles.label, compact && styles.labelSmall, { color: colors.text }]}>{label}</Text> : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  medium: {
    minHeight: 46,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  small: {
    minHeight: 34,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontFamily: Fonts.sansSemiBold,
  },
  labelSmall: {
    fontSize: 12,
  },
  disabled: {
    opacity: 0.65,
  },
});
