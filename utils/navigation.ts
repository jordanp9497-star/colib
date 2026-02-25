import { Linking, Platform } from "react-native";

type LatLng = { lat: number; lng: number };

export async function openNavigationApp(destination: LatLng) {
  const wazeAppUrl = `waze://?ll=${destination.lat},${destination.lng}&navigate=yes`;
  const wazeWebUrl = `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`;

  try {
    const canOpenWaze = await Linking.canOpenURL(wazeAppUrl);
    if (canOpenWaze) {
      await Linking.openURL(wazeWebUrl);
      return "waze" as const;
    }

    if (Platform.OS === "android") {
      const googleNavUrl = `google.navigation:q=${destination.lat},${destination.lng}`;
      const canOpenGoogle = await Linking.canOpenURL(googleNavUrl);
      if (canOpenGoogle) {
        await Linking.openURL(googleNavUrl);
        return "google_maps" as const;
      }
    }

    if (Platform.OS === "ios") {
      const appleMapsUrl = `http://maps.apple.com/?daddr=${destination.lat},${destination.lng}&dirflg=d`;
      const canOpenApple = await Linking.canOpenURL(appleMapsUrl);
      if (canOpenApple) {
        await Linking.openURL(appleMapsUrl);
        return "apple_maps" as const;
      }
    }
  } catch (error) {
    console.warn("[navigation] Impossible d'ouvrir une app de navigation", error);
  }

  return null;
}
