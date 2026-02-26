import { mutation } from "./_generated/server";
import { approximateZoneKey } from "./lib/geo";
import { formatAddressShort } from "./lib/address";
import { computeDynamicPrice } from "../packages/shared/pricing";
import { TERMS_VERSION } from "../packages/shared/legal";

const JOHN = {
  visitorId: "test_john_doe",
  name: "John Doe",
};

const ALICE = {
  visitorId: "test_alice_doe",
  name: "Alice Doe",
};

const VITRY_ADDRESS = {
  label: "11 Rue Oberkampf, 75011 Paris, France",
  city: "Paris",
  postalCode: "75011",
  countryCode: "FR",
  placeId: "seed-paris-oberkampf",
  lat: 48.8646,
  lng: 2.3792,
};

const MARNE_ADDRESS = {
  label: "23 Avenue Edouard Vaillant, 92100 Boulogne-Billancourt, France",
  city: "Boulogne-Billancourt",
  postalCode: "92100",
  countryCode: "FR",
  placeId: "seed-boulogne-vaillant",
  lat: 48.8324,
  lng: 2.2399,
};

const LEVALLOIS_ADDRESS = {
  label: "8 Rue du Capitaine Ferber, 92130 Issy-les-Moulineaux, France",
  city: "Issy-les-Moulineaux",
  postalCode: "92130",
  countryCode: "FR",
  placeId: "seed-issy-ferber",
  lat: 48.8192,
  lng: 2.268,
};

function buildTomorrowWindow() {
  const target = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const start = new Date(target);
  start.setHours(9, 0, 0, 0);
  const end = new Date(target);
  end.setHours(14, 0, 0, 0);
  return {
    startTs: start.getTime(),
    endTs: end.getTime(),
  };
}

export const bootstrapTestAccounts = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const ensureUser = async (visitorId: string, name: string) => {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_visitorId", (q) => q.eq("visitorId", visitorId))
        .first();

      if (existing) {
        if (
          existing.name !== name ||
          !existing.termsAcceptedAt ||
          existing.termsVersionAccepted !== TERMS_VERSION
        ) {
          await ctx.db.patch(existing._id, {
            name,
            termsAcceptedAt: now,
            termsVersionAccepted: TERMS_VERSION,
          });
        }
        return existing._id;
      }

      return await ctx.db.insert("users", {
        visitorId,
        name,
        emailVerified: false,
        identityVerified: "none",
        createdAt: now,
        termsAcceptedAt: now,
        termsVersionAccepted: TERMS_VERSION,
      });
    };

    await ensureUser(JOHN.visitorId, JOHN.name);
    await ensureUser(ALICE.visitorId, ALICE.name);

    const tripWindow = buildTomorrowWindow();
    const existingJohnTrips = await ctx.db
      .query("trips")
      .withIndex("by_owner_status", (q) => q.eq("ownerVisitorId", JOHN.visitorId).eq("status", "published"))
      .collect();

    let trip = existingJohnTrips.find(
      (item) =>
        item.originAddress.placeId === VITRY_ADDRESS.placeId &&
        item.destinationAddress.placeId === MARNE_ADDRESS.placeId
    );

    if (!trip) {
      const tripId = await ctx.db.insert("trips", {
        ownerVisitorId: JOHN.visitorId,
        userId: JOHN.visitorId,
        userName: JOHN.name,
        origin: formatAddressShort(VITRY_ADDRESS),
        destination: formatAddressShort(MARNE_ADDRESS),
        originAddress: VITRY_ADDRESS,
        destinationAddress: MARNE_ADDRESS,
        routePolyline: undefined,
        routeDistanceKm: 14,
        routeDurationMinutes: 36,
        date: new Date(tripWindow.startTs).toISOString(),
        windowStartTs: tripWindow.startTs,
        windowEndTs: tripWindow.endTs,
        availableSpace: "moyen",
        maxWeightKg: 20,
        maxVolumeDm3: 120,
        price: 24,
        maxDetourMinutes: 25,
        description: "Trajet factice publie par John Doe autour de Paris",
        phone: undefined,
        status: "published",
        publishedAt: now,
        updatedAt: now,
        createdAt: now,
        approxZoneKey: approximateZoneKey(VITRY_ADDRESS, MARNE_ADDRESS),
      });

      const createdTrip = await ctx.db.get(tripId);
      if (createdTrip) {
        trip = createdTrip;
      }
    }

    const existingAliceParcels = await ctx.db
      .query("parcels")
      .withIndex("by_owner_status", (q) => q.eq("ownerVisitorId", ALICE.visitorId).eq("status", "published"))
      .collect();

    let parcel = existingAliceParcels.find(
      (item) =>
        item.originAddress.placeId === VITRY_ADDRESS.placeId &&
        item.destinationAddress.placeId === LEVALLOIS_ADDRESS.placeId
    );

    if (!parcel) {
      const parcelId = await ctx.db.insert("parcels", {
        ownerVisitorId: ALICE.visitorId,
        userId: ALICE.visitorId,
        userName: ALICE.name,
        origin: formatAddressShort(VITRY_ADDRESS),
        destination: formatAddressShort(LEVALLOIS_ADDRESS),
        originAddress: VITRY_ADDRESS,
        destinationAddress: LEVALLOIS_ADDRESS,
        size: "petit",
        weight: 2,
        volumeDm3: 8,
        description: "Colis factice envoye par Alice Doe autour de Paris",
        fragile: false,
        urgencyLevel: "normal",
        insuranceValue: undefined,
        proposedPrice: 15,
        phone: undefined,
        recipientPhone: "+33600000000",
        parcelPhotoId: undefined,
        status: "published",
        preferredWindowStartTs: tripWindow.startTs,
        preferredWindowEndTs: tripWindow.endTs,
        publishedAt: now,
        matchedTripId: undefined,
        pricingEstimate: undefined,
        updatedAt: now,
        createdAt: now,
        approxZoneKey: approximateZoneKey(VITRY_ADDRESS, LEVALLOIS_ADDRESS),
      });

      const createdParcel = await ctx.db.get(parcelId);
      if (createdParcel) {
        parcel = createdParcel;
      }
    }

    if (!trip || !parcel) {
      throw new Error("Impossible de preparer les donnees de test");
    }

    const existingMatches = await ctx.db
      .query("matches")
      .withIndex("by_parcel", (q) => q.eq("parcelId", parcel._id))
      .collect();

    const hasMatch = existingMatches.some((item) => String(item.tripId) === String(trip._id));
    if (!hasMatch) {
      const pricing = computeDynamicPrice({
        baseDistanceKm: 8,
        weightKg: parcel.weight,
        volumeDm3: parcel.volumeDm3,
        detourMinutes: 12,
        urgencyLevel: parcel.urgencyLevel,
        fragile: parcel.fragile,
        insuranceValue: parcel.insuranceValue,
      });

      await ctx.db.insert("matches", {
        tripId: trip._id,
        parcelId: parcel._id,
        status: "candidate",
        score: 91,
        detourMinutes: 12,
        detourDistanceKm: 8,
        routeDistanceKm: trip.routeDistanceKm ?? 34,
        routeDurationMinutes: trip.routeDurationMinutes ?? 48,
        pricingEstimate: pricing,
        rankingReason: "Trajet de test fortement compatible",
        expiresAt: now + 24 * 60 * 60 * 1000,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      success: true,
      credentials: [
        { login: "john", password: "doe", name: JOHN.name, visitorId: JOHN.visitorId },
        { login: "alice", password: "doe", name: ALICE.name, visitorId: ALICE.visitorId },
      ],
      tripId: trip._id,
      parcelId: parcel._id,
    };
  },
});
