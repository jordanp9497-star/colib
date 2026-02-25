import { useEffect, useState } from "react";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, Text, StyleSheet, Pressable, Keyboard } from "react-native";
import "react-native-reanimated";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { Sora_600SemiBold, Sora_700Bold } from "@expo-google-fonts/sora";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { UserProvider } from "@/context/UserContext";
import { ActiveTripProvider } from "@/context/ActiveTripContext";
import { ColibLogoMark } from "@/components/branding/ColibLogoMark";
import { Colors, Fonts, Typography } from "@/constants/theme";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [showStartupScreen, setShowStartupScreen] = useState(true);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Sora_600SemiBold,
    Sora_700Bold,
  });

  useEffect(() => {
    const timer = setTimeout(() => setShowStartupScreen(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  if (!convex) {
    return (
      <View style={setupStyles.container}>
        <Text style={setupStyles.title}>Configuration requise</Text>
        <Text style={setupStyles.text}>
          EXPO_PUBLIC_CONVEX_URL nest pas defini.
        </Text>
        <Text style={setupStyles.code}>npx convex dev</Text>
        <Text style={setupStyles.text}>
          Cette commande creera le fichier .env.local avec URL Convex.
        </Text>
      </View>
    );
  }

  if (showStartupScreen) {
    return (
      <View style={startupStyles.container}>
        <View style={startupStyles.logoWrap}>
          <ColibLogoMark size={86} color="#EAF0F6" backgroundColor="#1D2630" />
        </View>
        <Text style={startupStyles.subtitle}>
          Colib, transportez{"\n"}
          où vous voulez,{"\n"}
          quand vous voulez.
        </Text>
      </View>
    );
  }

  const themedNavigation = {
    ...(colorScheme === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(colorScheme === "dark" ? DarkTheme.colors : DefaultTheme.colors),
      background: Colors.dark.background,
      card: Colors.dark.card,
      text: Colors.dark.text,
      border: Colors.dark.border,
      primary: Colors.dark.primary,
      notification: Colors.dark.error,
    },
  };

  return (
    <ConvexProvider client={convex}>
      <UserProvider>
        <ActiveTripProvider>
          <ThemeProvider
            value={themedNavigation}
          >
            <Pressable style={styles.keyboardDismissRoot} onPress={Keyboard.dismiss}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="settings" options={{ headerShown: false }} />
              </Stack>
            </Pressable>
            <StatusBar style="light" />
          </ThemeProvider>
        </ActiveTripProvider>
      </UserProvider>
    </ConvexProvider>
  );
}

const setupStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: Colors.dark.background,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Fonts.display,
    marginBottom: 16,
  },
  text: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 22,
    fontFamily: Fonts.sans,
  },
  code: {
    fontSize: 15,
    fontFamily: "monospace",
    backgroundColor: Colors.dark.surfaceMuted,
    color: Colors.dark.text,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginVertical: 12,
    overflow: "hidden",
  },
});

const startupStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.background,
    padding: 28,
  },
  logoWrap: {
    width: 104,
    height: 104,
    borderRadius: 24,
    backgroundColor: Colors.dark.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  subtitle: {
    ...Typography.onboarding,
    color: Colors.dark.text,
    textAlign: "left",
    maxWidth: 320,
    fontFamily: Fonts.display,
  },
});

const styles = StyleSheet.create({
  keyboardDismissRoot: {
    flex: 1,
  },
});
