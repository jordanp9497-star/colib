import test from "node:test";
import assert from "node:assert/strict";
import { rankTripSessionCandidates, scoreTripSessionCandidate } from "../packages/shared/tripSessionMatching";

test("scoreTripSessionCandidate filtre les detours trop grands", () => {
  const scored = scoreTripSessionCandidate({
    origin: { lat: 48.8566, lng: 2.3522 },
    destination: { lat: 48.85, lng: 2.6 },
    deviationMaxMinutes: 5,
    candidate: {
      parcelId: "parcel-far",
      pickupLabel: "Pickup",
      dropLabel: "Drop",
      pickup: { lat: 48.45, lng: 1.8 },
      drop: { lat: 48.38, lng: 1.6 },
    },
  });

  assert.equal(scored, null);
});

test("rankTripSessionCandidates trie les meilleurs scores", () => {
  const ranked = rankTripSessionCandidates({
    origin: { lat: 48.8566, lng: 2.3522 },
    destination: { lat: 48.864, lng: 2.42 },
    deviationMaxMinutes: 20,
    candidates: [
      {
        parcelId: "near",
        pickupLabel: "A",
        dropLabel: "B",
        pickup: { lat: 48.857, lng: 2.36 },
        drop: { lat: 48.86, lng: 2.41 },
      },
      {
        parcelId: "far",
        pickupLabel: "C",
        dropLabel: "D",
        pickup: { lat: 48.8, lng: 2.1 },
        drop: { lat: 48.78, lng: 2.05 },
      },
    ],
  });

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.parcelId, "near");
  assert.ok((ranked[0]?.score ?? 0) > 0);
});
