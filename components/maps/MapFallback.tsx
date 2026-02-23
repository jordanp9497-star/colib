import { StyleSheet, Text, View } from "react-native";

export function MapFallback({ title }: { title: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>
        Branchez react-native-maps (mobile) et Mapbox GL/MapLibre (web) sur ce composant.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#E2E8F0",
    minHeight: 220,
    padding: 14,
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
    color: "#334155",
  },
});
