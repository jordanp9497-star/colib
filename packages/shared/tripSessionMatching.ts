export type LatLng = {
  lat: number;
  lng: number;
};

export type TripSessionDeviation = 5 | 10 | 20 | 30;

export type TripSessionParcelCandidate = {
  parcelId: string;
  pickupLabel: string;
  dropLabel: string;
  pickup: LatLng;
  drop: LatLng;
};

export type ScoredTripSessionParcel = TripSessionParcelCandidate & {
  score: number;
  estimatedDetourMinutes: number;
  pickupDistanceToCorridorKm: number;
  dropDistanceToDestinationKm: number;
};

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineKm(a: LatLng, b: LatLng) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function distancePointToSegmentKm(point: LatLng, start: LatLng, end: LatLng) {
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
  const projected = { lat: y1 + t * dy, lng: x1 + t * dx };
  return haversineKm(point, projected);
}

function computeEstimatedDetourMinutes(pickupDistanceToCorridorKm: number, dropDistanceToDestinationKm: number) {
  const detourDistanceKm = pickupDistanceToCorridorKm * 1.35 + dropDistanceToDestinationKm * 0.75;
  return Math.round((detourDistanceKm / 42) * 60);
}

export function scoreTripSessionCandidate(args: {
  origin: LatLng;
  destination: LatLng;
  deviationMaxMinutes: TripSessionDeviation;
  candidate: TripSessionParcelCandidate;
}) {
  const { origin, destination, deviationMaxMinutes, candidate } = args;
  const pickupDistanceToCorridorKm = distancePointToSegmentKm(candidate.pickup, origin, destination);
  const dropDistanceToDestinationKm = haversineKm(candidate.drop, destination);
  const estimatedDetourMinutes = computeEstimatedDetourMinutes(
    pickupDistanceToCorridorKm,
    dropDistanceToDestinationKm
  );

  if (estimatedDetourMinutes > deviationMaxMinutes) {
    return null;
  }

  // Weights tuned for an MVP: lower is better then inverted to a 0-100 score.
  const weightedDistance = pickupDistanceToCorridorKm * 0.45 + dropDistanceToDestinationKm * 0.35;
  const weightedDetour = estimatedDetourMinutes * 0.2;
  const raw = weightedDistance + weightedDetour;
  const score = Math.max(0, Math.round(100 - raw * 10));

  return {
    ...candidate,
    score,
    estimatedDetourMinutes,
    pickupDistanceToCorridorKm: Math.round(pickupDistanceToCorridorKm * 100) / 100,
    dropDistanceToDestinationKm: Math.round(dropDistanceToDestinationKm * 100) / 100,
  } satisfies ScoredTripSessionParcel;
}

export function rankTripSessionCandidates(args: {
  origin: LatLng;
  destination: LatLng;
  deviationMaxMinutes: TripSessionDeviation;
  candidates: TripSessionParcelCandidate[];
  limit?: number;
}) {
  const scored = args.candidates
    .map((candidate) =>
      scoreTripSessionCandidate({
        origin: args.origin,
        destination: args.destination,
        deviationMaxMinutes: args.deviationMaxMinutes,
        candidate,
      })
    )
    .filter((item): item is ScoredTripSessionParcel => item !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.estimatedDetourMinutes - b.estimatedDetourMinutes;
    });

  if (args.limit && args.limit > 0) {
    return scored.slice(0, args.limit);
  }

  return scored;
}
