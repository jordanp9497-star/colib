import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, Text, StyleSheet } from "react-native";
import "react-native-reanimated";
import { ConvexProvider, ConvexReactClient } from "convex/react";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { UserProvider } from "@/context/UserContext";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  if (!convex) {
    return (
      <View style={setupStyles.container}>
        <Text style={setupStyles.title}>Configuration requise</Text>
        <Text style={setupStyles.text}>
          EXPO_PUBLIC_CONVEX_URL n'est pas defini.
        </Text>
        <Text style={setupStyles.code}>npx convex dev</Text>
        <Text style={setupStyles.text}>
          Cette commande creera le fichier .env.local avec l'URL Convex.
        </Text>
      </View>
    );
  }

  return (
    <ConvexProvider client={convex}>
      <UserProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
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
    backgroundColor: "#F8FAFC",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 16,
  },
  text: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 22,
  },
  code: {
    fontSize: 15,
    fontFamily: "monospace",
    backgroundColor: "#1E293B",
    color: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginVertical: 12,
    overflow: "hidden",
  },
});
