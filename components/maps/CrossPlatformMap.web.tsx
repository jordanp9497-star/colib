import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import type { CrossPlatformMapProps } from "./CrossPlatformMap.types";

type WebMap = {
  remove: () => void;
  addControl: (control: unknown) => void;
  on: (event: string, cb: () => void) => void;
  fitBounds: (bounds: [[number, number], [number, number]], options?: { padding?: number }) => void;
  addSource: (id: string, source: unknown) => void;
  getSource: (id: string) => unknown;
  addLayer: (layer: unknown) => void;
};

export function CrossPlatformMap({ pins, paths = [], height = 260 }: CrossPlatformMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<WebMap | null>(null);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      if (!containerRef.current || pins.length === 0) return;

      const maplibre = await import("maplibre-gl");

      if (!document.getElementById("maplibre-css")) {
        const css = document.createElement("link");
        css.id = "maplibre-css";
        css.rel = "stylesheet";
        css.href = "https://unpkg.com/maplibre-gl@5.11.0/dist/maplibre-gl.css";
        document.head.appendChild(css);
      }

      if (!mounted) return;

      if (!mapRef.current) {
        mapRef.current = new maplibre.Map({
          container: containerRef.current,
          style: "https://demotiles.maplibre.org/style.json",
          center: [pins[0].longitude, pins[0].latitude],
          zoom: 5,
        }) as unknown as WebMap;
        mapRef.current.addControl(new maplibre.NavigationControl());
      }

      const map = mapRef.current as unknown as any;
      map.on("load", () => {
        pins.forEach((pin: any) => {
          const marker = new maplibre.Marker({ color: pin.color ?? "#1D4ED8" })
            .setLngLat([pin.longitude, pin.latitude])
            .setPopup(new maplibre.Popup().setText(pin.title ?? "Point"));
          marker.addTo(map);
        });

        paths.forEach((path: any) => {
          if (!path.coordinates?.length) return;
          const sourceId = `path-${path.id}`;
          map.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: path.coordinates.map((coord: any) => [coord.longitude, coord.latitude]),
              },
            },
          });
          map.addLayer({
            id: sourceId,
            type: "line",
            source: sourceId,
            paint: {
              "line-color": path.color ?? "#1D4ED8",
              "line-width": path.width ?? 3,
            },
          });
        });

        const lats = pins.map((pin) => pin.latitude);
        const lngs = pins.map((pin) => pin.longitude);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          { padding: 40 }
        );
      });
    };

    void boot();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [pins, paths]);

  return <View style={[styles.box, { height }]}>{<div ref={containerRef} style={{ width: "100%", height: "100%" }} />}</View>;
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#E2E8F0",
  },
});
