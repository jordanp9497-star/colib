import test from "node:test";
import assert from "node:assert/strict";
import { shouldPushLocationUpdate } from "../utils/tripTracking";

test("shouldPushLocationUpdate envoie la premiere position", () => {
  const next = { lat: 48.8566, lng: 2.3522, timestamp: 1000 };
  assert.equal(shouldPushLocationUpdate(null, next), true);
});

test("shouldPushLocationUpdate bloque les micro updates", () => {
  const previous = { lat: 48.8566, lng: 2.3522, timestamp: 1_000 };
  const next = { lat: 48.85661, lng: 2.35221, timestamp: 5_000 };
  assert.equal(shouldPushLocationUpdate(previous, next), false);
});

test("shouldPushLocationUpdate autorise un envoi apres intervalle", () => {
  const previous = { lat: 48.8566, lng: 2.3522, timestamp: 1_000 };
  const next = { lat: 48.85661, lng: 2.35221, timestamp: 40_000 };
  assert.equal(shouldPushLocationUpdate(previous, next), true);
});
