export type LatLng = { lat: number; lng: number };

export function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const earthKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthKm * Math.asin(Math.sqrt(h));
}

export function distancePointToSegmentKm(point: LatLng, start: LatLng, end: LatLng): number {
  const x = point.lng;
  const y = point.lat;
  const x1 = start.lng;
  const y1 = start.lat;
  const x2 = end.lng;
  const y2 = end.lat;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return haversineKm(point, start);
  }

  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  const projected = { lng: x1 + t * dx, lat: y1 + t * dy };
  return haversineKm(point, projected);
}

export function approximateZoneKey(a: LatLng, b: LatLng): string {
  const midLat = (a.lat + b.lat) / 2;
  const midLng = (a.lng + b.lng) / 2;
  return `${Math.round(midLat * 10) / 10}_${Math.round(midLng * 10) / 10}`;
}

export function windowsOverlap(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number
) {
  return leftStart <= rightEnd && rightStart <= leftEnd;
}
