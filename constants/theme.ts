import { Platform } from "react-native";

const accentPrimary = "#2F80ED";
const accentSecondary = "#22A699";

export const Colors = {
  light: {
    canvas: "#0B1118",
    surface: "#131C26",
    surfaceMuted: "#1A2531",
    text: "#EAF0F6",
    textSecondary: "#99A7B6",
    background: "#0B1118",
    card: "#131C26",
    tint: accentPrimary,
    icon: "#8D9AAA",
    border: "#243242",
    tabIconDefault: "#748396",
    tabIconSelected: accentPrimary,
    primary: accentPrimary,
    primaryLight: "#17324F",
    secondary: accentSecondary,
    success: "#18B26A",
    warning: "#F4B740",
    error: "#E5484D",
    info: "#3B82F6",
  },
  dark: {
    canvas: "#0B1118",
    surface: "#131C26",
    surfaceMuted: "#1A2531",
    text: "#EAF0F6",
    textSecondary: "#99A7B6",
    background: "#0B1118",
    card: "#131C26",
    tint: accentPrimary,
    icon: "#8D9AAA",
    border: "#243242",
    tabIconDefault: "#748396",
    tabIconSelected: accentPrimary,
    primary: accentPrimary,
    primaryLight: "#17324F",
    secondary: accentSecondary,
    success: "#18B26A",
    warning: "#F4B740",
    error: "#E5484D",
    info: "#3B82F6",
  },
};

export const Typography = {
  onboarding: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
  },
  display: { fontSize: 24, lineHeight: 30, fontWeight: "600" as const },
  h1: { fontSize: 20, lineHeight: 26, fontWeight: "600" as const },
  h2: { fontSize: 16, lineHeight: 22, fontWeight: "600" as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontWeight: "600" as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" as const },
  label: { fontSize: 14, lineHeight: 18, fontWeight: "600" as const },
};

export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const Fonts = Platform.select({
  ios: {
    display: "Sora_700Bold",
    displaySemiBold: "Sora_600SemiBold",
    sans: "Inter_400Regular",
    sansMedium: "Inter_500Medium",
    sansSemiBold: "Inter_600SemiBold",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    display: "Sora_700Bold",
    displaySemiBold: "Sora_600SemiBold",
    sans: "Inter_400Regular",
    sansMedium: "Inter_500Medium",
    sansSemiBold: "Inter_600SemiBold",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    display: "'Sora', 'Avenir Next', sans-serif",
    displaySemiBold: "'Sora', 'Avenir Next', sans-serif",
    sans: "'Inter', 'Avenir Next', sans-serif",
    sansMedium: "'Inter', 'Avenir Next', sans-serif",
    sansSemiBold: "'Inter', 'Avenir Next', sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
