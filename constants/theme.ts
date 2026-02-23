import { Platform } from "react-native";

const tintColorLight = "#6366F1";
const tintColorDark = "#818CF8";

export const Colors = {
  light: {
    text: "#1E293B",
    textSecondary: "#64748B",
    background: "#F8FAFC",
    card: "#FFFFFF",
    tint: tintColorLight,
    icon: "#94A3B8",
    border: "#E2E8F0",
    tabIconDefault: "#94A3B8",
    tabIconSelected: tintColorLight,
    primary: tintColorLight,
    primaryLight: "#EEF2FF",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
  },
  dark: {
    text: "#F1F5F9",
    textSecondary: "#94A3B8",
    background: "#0F172A",
    card: "#1E293B",
    tint: tintColorDark,
    icon: "#64748B",
    border: "#334155",
    tabIconDefault: "#64748B",
    tabIconSelected: tintColorDark,
    primary: tintColorDark,
    primaryLight: "#1E1B4B",
    success: "#4ADE80",
    warning: "#FBBF24",
    error: "#F87171",
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
