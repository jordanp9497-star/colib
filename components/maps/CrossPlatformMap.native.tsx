import { StyleSheet, Text, View } from "react-native";
import type { CrossPlatformMapProps } from "./CrossPlatformMap.types";

export function CrossPlatformMap({ pins, paths = [], height = 260 }: CrossPlatformMapProps) {
  let MapView: any;
  let Marker: any;
  let Polyline: any;

  try {
    const mapsModule = require("react-native-maps");
    MapView = mapsModule.default;
    Marker = mapsModule.Marker;
    Polyline = mapsModule.Polyline;
  } catch {
    return (
      <View style={[styles.empty, { height }]}> 
        <Text style={styles.title}>Carte native indisponible</Text>
        <Text style={styles.text}>
          Redemarrez Expo apres installation, ou utilisez un dev build si necessaire.
        </Text>
      </View>
    );
  }

  if (pins.length === 0) {
    return <View style={[styles.empty, { height }]} />;
  }

  const center = pins[0];

  return (
    <View style={{ height, borderRadius: 14, overflow: "hidden" }}>
      <MapView
        style={StyleSheet.absoluteFill}
        mapType="standard"
        showsTraffic
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.9,
          longitudeDelta: 0.9,
        }}
      >
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            title={pin.title}
            description={pin.description}
            pinColor={pin.color}
          />
        ))}
        {paths.map((path) => (
          <Polyline
            key={path.id}
            coordinates={path.coordinates}
            strokeColor={path.color ?? "#1D4ED8"}
            strokeWidth={path.width ?? 3}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    padding: 14,
  },
  title: {
    color: "#0F172A",
    fontWeight: "700",
    marginBottom: 4,
  },
  text: {
    color: "#334155",
    fontSize: 12,
  },
});
