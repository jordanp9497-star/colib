import { Tabs } from "expo-router";
import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { ActiveTripBanner } from "@/components/trips/ActiveTripBanner";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "dark"];

  return (
    <View style={styles.container}>
      <ActiveTripBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.tint,
          tabBarInactiveTintColor: colors.tabIconDefault,
          tabBarButton: HapticTab,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            height: 64,
            paddingTop: 4,
          },
          headerStyle: {
            backgroundColor: colors.card,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontFamily: Fonts.displaySemiBold,
            fontSize: 20,
          },
          tabBarLabelStyle: {
            fontFamily: Fonts.sansSemiBold,
            fontSize: 11,
          },
          tabBarItemStyle: {
            borderRadius: 8,
            marginHorizontal: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Accueil",
            tabBarIcon: ({ color, size, focused }) => (
              <View style={styles.tabIconWrap}>
                <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="publish"
          options={{
            title: "Publier",
            tabBarIcon: ({ color, size, focused }) => (
              <View style={styles.tabIconWrap}>
                <Ionicons name={focused ? "add-circle" : "add-circle-outline"} size={size} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: "Activite",
            tabBarIcon: ({ color, size, focused }) => (
              <View style={styles.tabIconWrap}>
                <Ionicons name={focused ? "notifications" : "notifications-outline"} size={size} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profil",
            tabBarIcon: ({ color, size, focused }) => (
              <View style={styles.tabIconWrap}>
                <Ionicons name={focused ? "person" : "person-outline"} size={size} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="send"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen name="offer" options={{ href: null }} />
        <Tabs.Screen name="map" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  tabIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
  },
});
