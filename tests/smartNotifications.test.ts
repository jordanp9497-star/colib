import test from "node:test";
import assert from "node:assert/strict";
import {
  canSendPushInCurrentHour,
  normalizeDriverNotificationSettings,
} from "../packages/shared/smartNotifications";

test("normalizeDriverNotificationSettings applique les bornes", () => {
  const settings = normalizeDriverNotificationSettings({
    notifyRadiusKm: 200,
    minPrice: -5,
    urgentOnly: true,
    maxPushPerHour: 999,
  });

  assert.equal(settings.notifyRadiusKm, 30);
  assert.equal(settings.minPrice, 0);
  assert.equal(settings.urgentOnly, true);
  assert.equal(settings.maxPushPerHour, 20);
});

test("canSendPushInCurrentHour bloque a la limite", () => {
  assert.equal(canSendPushInCurrentHour({ sentInLastHour: 4, maxPushPerHour: 5 }), true);
  assert.equal(canSendPushInCurrentHour({ sentInLastHour: 5, maxPushPerHour: 5 }), false);
});
