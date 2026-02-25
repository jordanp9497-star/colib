export type LocationPoint = {
  lat: number;
  lng: number;
  timestamp: number;
};

export const LOCATION_PUSH_MIN_INTERVAL_MS = 20_000;
export const LOCATION_PUSH_MIN_DISTANCE_METERS = 120;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMeters(a: Pick<LocationPoint, "lat" | "lng">, b: Pick<LocationPoint, "lat" | "lng">) {
  const earthMeters = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthMeters * Math.asin(Math.sqrt(h));
}

export function shouldPushLocationUpdate(previous: LocationPoint | null, next: LocationPoint) {
  if (!previous) return true;

  const elapsed = next.timestamp - previous.timestamp;
  if (elapsed >= LOCATION_PUSH_MIN_INTERVAL_MS) {
    return true;
  }

  const movedMeters = distanceMeters(previous, next);
  return movedMeters >= LOCATION_PUSH_MIN_DISTANCE_METERS;
}
