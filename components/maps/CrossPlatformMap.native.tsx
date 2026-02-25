import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CrossPlatformMapProps } from "./CrossPlatformMap.types";

export function CrossPlatformMap({ pins, paths = [], height = 260, onPinPress, selectedPinId }: CrossPlatformMapProps) {
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
        {pins.map((pin) => {
          const isSelected = pin.id === selectedPinId;
          return (
            <Marker
              key={pin.id}
              coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
              title={pin.title}
              description={pin.description}
              pinColor={pin.kind === "parcel" || pin.kind === "cluster" ? undefined : pin.color}
              onPress={() => onPinPress?.(pin.id)}
            >
              {pin.kind === "parcel" ? (
                <View style={[styles.parcelMarker, isSelected && styles.parcelMarkerSelected]}>
                  <Ionicons name="cube" size={12} color="#FFFFFF" />
                </View>
              ) : null}
              {pin.kind === "cluster" ? (
                <View style={[styles.clusterMarker, isSelected && styles.clusterMarkerSelected]}>
                  <Text style={styles.clusterText}>{pin.title?.split(" ")[0] ?? "2"}</Text>
                </View>
              ) : null}
            </Marker>
          );
        })}
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
  parcelMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EA580C",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 3,
  },
  parcelMarkerSelected: {
    transform: [{ scale: 1.16 }],
    backgroundColor: "#DC2626",
  },
  clusterMarker: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#2563EB",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    shadowColor: "#0F172A",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 3,
  },
  clusterMarkerSelected: {
    transform: [{ scale: 1.1 }],
    backgroundColor: "#1D4ED8",
  },
  clusterText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
});
