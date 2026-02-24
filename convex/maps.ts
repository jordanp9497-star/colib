import { v } from "convex/values";
import { action } from "./_generated/server";
import type {
  AddressSuggestion,
  GeocodedAddress,
  MapsProvider,
  RoutePoint,
  RouteResult,
} from "../packages/shared/maps";
import { haversineKm } from "./lib/geo";

function shortLabelFromParts(street: string | undefined, postalCode: string | undefined, city: string | undefined, fallback: string) {
  const streetPart = street?.trim();
  const cityPart = [postalCode, city].filter(Boolean).join(" ").trim();
  if (streetPart && cityPart) return `${streetPart}, ${cityPart}`;
  if (streetPart) return streetPart;
  if (cityPart) return cityPart;
  return fallback;
}

function trimSecondary(secondaryText: string | undefined) {
  if (!secondaryText) return undefined;
  const chunks = secondaryText
    .split(",")
    .map((it) => it.trim())
    .filter(Boolean);
  return chunks.slice(0, 2).join(", ");
}

const MAPS_PROVIDER = process.env.MAPS_PROVIDER ?? "mock";
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const memoryCache = new Map<string, { expiresAt: number; value: unknown }>();

function cacheKey(namespace: string, payload: unknown) {
  return `${namespace}:${JSON.stringify(payload)}`;
}

async function withCache<T>(
  namespace: string,
  payload: unknown,
  ttlSeconds: number,
  producer: () => Promise<T>
): Promise<T> {
  const key = cacheKey(namespace, payload);
  const now = Date.now();
  const hit = memoryCache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }

  const fresh = await producer();
  memoryCache.set(key, {
    value: fresh,
    expiresAt: now + ttlSeconds * 1000,
  });
  return fresh;
}

class MockMapsProvider implements MapsProvider {
  async autocompleteAddress(
    input: string,
    opts?: { countryCode?: string; limit?: number }
  ): Promise<AddressSuggestion[]> {
    const value = input.trim();
    if (value.length < 2) return [];
    return [
      {
        placeId: `mock_${value}_1`,
        label: `${value}, Paris, France`,
        mainText: value,
        secondaryText: "Paris, France",
      },
      {
        placeId: `mock_${value}_2`,
        label: `${value}, Lyon, France`,
        mainText: value,
        secondaryText: "Lyon, France",
      },
    ].slice(0, opts?.limit ?? 6);
  }

  async geocodePlace(placeId: string): Promise<GeocodedAddress | null> {
    const street = placeId.replace(/^mock_/, "").replaceAll("_", " ");
    return {
      placeId,
      label: shortLabelFromParts(street, "75001", "Paris", street),
      city: "Paris",
      countryCode: "FR",
      postalCode: "75001",
      lat: 48.8566,
      lng: 2.3522,
    };
  }

  async getRoute(origin: RoutePoint, destination: RoutePoint): Promise<RouteResult | null> {
    const distanceKm = haversineKm(origin, destination) * 1.25;
    const durationMinutes = (distanceKm / 55) * 60;
    return {
      distanceKm,
      durationMinutes,
      points: [origin, destination],
    };
  }
}

class GoogleMapsProvider implements MapsProvider {
  constructor(private readonly apiKey: string) {}

  async autocompleteAddress(input: string): Promise<AddressSuggestion[]> {
    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    url.searchParams.set("input", input);
    url.searchParams.set("types", "geocode");
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("language", "fr");

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Google autocomplete HTTP ${res.status}`);
    const json = (await res.json()) as {
      status: string;
      predictions?: Array<{
        place_id: string;
        description: string;
        structured_formatting?: { main_text?: string; secondary_text?: string };
      }>;
      error_message?: string;
    };

    if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
      throw new Error(json.error_message ?? `Google autocomplete status ${json.status}`);
    }

    return (json.predictions ?? []).map((prediction) => {
      const mainText = prediction.structured_formatting?.main_text ?? prediction.description;
      const secondaryText = trimSecondary(prediction.structured_formatting?.secondary_text);
      return {
        placeId: prediction.place_id,
        label: prediction.description,
        mainText,
        secondaryText,
      };
    });
  }

  async geocodePlace(placeId: string): Promise<GeocodedAddress | null> {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("fields", "place_id,formatted_address,geometry,address_components");
    url.searchParams.set("language", "fr");

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Google geocode HTTP ${res.status}`);

    const json = (await res.json()) as {
      status: string;
      result?: {
        place_id: string;
        formatted_address: string;
        geometry?: { location?: { lat?: number; lng?: number } };
        address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
      };
    };

    if (json.status !== "OK" || !json.result?.geometry?.location) {
      return null;
    }

    const city =
      json.result.address_components?.find((it) => it.types.includes("locality"))?.long_name ??
      json.result.address_components?.find((it) => it.types.includes("postal_town"))?.long_name;
    const postalCode = json.result.address_components?.find((it) => it.types.includes("postal_code"))?.long_name;
    const countryCode = json.result.address_components?.find((it) => it.types.includes("country"))?.short_name;
    const streetNumber = json.result.address_components?.find((it) => it.types.includes("street_number"))?.long_name;
    const route = json.result.address_components?.find((it) => it.types.includes("route"))?.long_name;
    const formattedStreet = [streetNumber, route].filter(Boolean).join(" ").trim();
    const fallbackStreet = json.result.formatted_address.split(",")[0]?.trim();
    const label = shortLabelFromParts(formattedStreet || fallbackStreet, postalCode, city, json.result.formatted_address);

    return {
      placeId: json.result.place_id,
      label,
      city,
      postalCode,
      countryCode,
      lat: json.result.geometry.location.lat ?? 0,
      lng: json.result.geometry.location.lng ?? 0,
    };
  }

  async getRoute(origin: RoutePoint, destination: RoutePoint): Promise<RouteResult | null> {
    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
    url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
    url.searchParams.set("key", this.apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Google route HTTP ${res.status}`);
    const json = (await res.json()) as {
      routes?: Array<{
        overview_polyline?: { points?: string };
        legs?: Array<{ distance?: { value?: number }; duration?: { value?: number } }>;
      }>;
    };

    const route = json.routes?.[0];
    const leg = route?.legs?.[0];
    if (!route || !leg) return null;

    return {
      polyline: route.overview_polyline?.points,
      distanceKm: (leg.distance?.value ?? 0) / 1000,
      durationMinutes: (leg.duration?.value ?? 0) / 60,
    };
  }
}

class MapboxStubProvider implements MapsProvider {
  async autocompleteAddress(): Promise<AddressSuggestion[]> {
    throw new Error("Mapbox provider stub not implemented yet");
  }
  async geocodePlace(): Promise<GeocodedAddress | null> {
    throw new Error("Mapbox provider stub not implemented yet");
  }
  async getRoute(): Promise<RouteResult | null> {
    throw new Error("Mapbox provider stub not implemented yet");
  }
}

class OpenStreetMapProvider implements MapsProvider {
  async autocompleteAddress(input: string, opts?: { countryCode?: string; limit?: number }): Promise<AddressSuggestion[]> {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("q", input);
    url.searchParams.set("limit", String(opts?.limit ?? 6));
    if (opts?.countryCode) {
      url.searchParams.set("countrycodes", opts.countryCode.toLowerCase());
    }

    const res = await fetch(url.toString(), {
      headers: {
        "accept-language": "fr",
      },
    });
    if (!res.ok) {
      throw new Error(`OSM autocomplete HTTP ${res.status}`);
    }

    const items = (await res.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
      address?: {
        house_number?: string;
        road?: string;
        pedestrian?: string;
        city?: string;
        town?: string;
        village?: string;
        postcode?: string;
        country_code?: string;
      };
    }>;

    return items.map((item, index) => {
      const street = [item.address?.house_number, item.address?.road ?? item.address?.pedestrian]
        .filter(Boolean)
        .join(" ")
        .trim();
      const city = item.address?.city ?? item.address?.town ?? item.address?.village;
      const mainText = street || item.display_name.split(",")[0]?.trim() || item.display_name;
      const secondaryText = [item.address?.postcode, city].filter(Boolean).join(" ").trim();
      const placeId = `osm:${item.lat},${item.lon}:${index}`;
      return {
        placeId,
        label: item.display_name,
        mainText,
        secondaryText: secondaryText || trimSecondary(item.display_name.replace(mainText, "").replace(/^,\s*/, "")),
      };
    });
  }

  async geocodePlace(placeId: string): Promise<GeocodedAddress | null> {
    if (!placeId.startsWith("osm:")) {
      return null;
    }

    const encoded = placeId.replace("osm:", "").split(":")[0];
    const [latStr, lngStr] = encoded.split(",");
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    const reverseUrl = new URL("https://nominatim.openstreetmap.org/reverse");
    reverseUrl.searchParams.set("format", "jsonv2");
    reverseUrl.searchParams.set("lat", String(lat));
    reverseUrl.searchParams.set("lon", String(lng));

    const res = await fetch(reverseUrl.toString(), {
      headers: {
        "accept-language": "fr",
      },
    });
    if (!res.ok) {
      return {
        placeId,
        label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lng,
      };
    }

    const item = (await res.json()) as {
      display_name?: string;
      address?: {
        house_number?: string;
        road?: string;
        pedestrian?: string;
        city?: string;
        town?: string;
        village?: string;
        postcode?: string;
        country_code?: string;
      };
    };

    const street = [item.address?.house_number, item.address?.road ?? item.address?.pedestrian]
      .filter(Boolean)
      .join(" ")
      .trim();
    const city = item.address?.city ?? item.address?.town ?? item.address?.village;
    const postalCode = item.address?.postcode;
    const fallback = item.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const label = shortLabelFromParts(street, postalCode, city, fallback);

    return {
      placeId,
      label,
      city,
      postalCode,
      countryCode: item.address?.country_code?.toUpperCase(),
      lat,
      lng,
    };
  }

  async getRoute(origin: RoutePoint, destination: RoutePoint): Promise<RouteResult | null> {
    const url = new URL(
      `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`
    );
    url.searchParams.set("overview", "full");
    url.searchParams.set("geometries", "polyline");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`OSRM route HTTP ${res.status}`);
    }

    const json = (await res.json()) as {
      routes?: Array<{ distance: number; duration: number; geometry?: string }>;
    };
    const route = json.routes?.[0];
    if (!route) return null;

    return {
      distanceKm: route.distance / 1000,
      durationMinutes: route.duration / 60,
      polyline: route.geometry,
    };
  }
}

function buildProvider(): MapsProvider {
  if ((MAPS_PROVIDER === "google" || MAPS_PROVIDER === "auto") && GOOGLE_MAPS_API_KEY) {
    return new GoogleMapsProvider(GOOGLE_MAPS_API_KEY);
  }
  if (MAPS_PROVIDER === "osm" || MAPS_PROVIDER === "auto") {
    return new OpenStreetMapProvider();
  }
  if (MAPS_PROVIDER === "mapbox") {
    return new MapboxStubProvider();
  }
  if (GOOGLE_MAPS_API_KEY) {
    return new GoogleMapsProvider(GOOGLE_MAPS_API_KEY);
  }
  return new OpenStreetMapProvider();
}

function fallbackProvider() {
  return new MockMapsProvider();
}

export const autocompleteAddress = action({
  args: {
    input: v.string(),
    countryCode: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    if (args.input.trim().length < 2) return [] as AddressSuggestion[];

    return withCache(
      "autocomplete",
      { input: args.input.trim().toLowerCase(), countryCode: args.countryCode, limit: args.limit },
      120,
      async () => {
        try {
          const provider = buildProvider();
          const entries = await provider.autocompleteAddress(args.input, {
            countryCode: args.countryCode,
            limit: args.limit,
          });
          if (entries.length > 0) return entries.slice(0, args.limit ?? 6);
        } catch {
          // fallback below
        }
        const fallback = fallbackProvider();
        return fallback.autocompleteAddress(args.input, {
          countryCode: args.countryCode,
          limit: args.limit,
        });
      }
    );
  },
});

export const geocodePlace = action({
  args: { placeId: v.string() },
  handler: async (_ctx, args) => {
    return withCache("geocode", { placeId: args.placeId }, 60 * 60 * 24, async () => {
      try {
        const provider = buildProvider();
        const value = await provider.geocodePlace(args.placeId);
        if (value) return value;
      } catch {
        // fallback below
      }
      return fallbackProvider().geocodePlace(args.placeId);
    });
  },
});

export const getRoute = action({
  args: {
    origin: v.object({ lat: v.number(), lng: v.number() }),
    destination: v.object({ lat: v.number(), lng: v.number() }),
  },
  handler: async (_ctx, args) => {
    return withCache("route", args, 60 * 60 * 6, async () => {
      try {
        const provider = buildProvider();
        const route = await provider.getRoute(args.origin, args.destination);
        if (route) return route;
      } catch {
        // fallback below
      }
      return fallbackProvider().getRoute(args.origin, args.destination);
    });
  },
});

export const estimateDetourForParcelOnTrip = action({
  args: {
    tripOrigin: v.object({ lat: v.number(), lng: v.number() }),
    tripDestination: v.object({ lat: v.number(), lng: v.number() }),
    parcelOrigin: v.object({ lat: v.number(), lng: v.number() }),
    parcelDestination: v.object({ lat: v.number(), lng: v.number() }),
  },
  handler: async (_ctx, args) => {
    const provider = buildProvider();
    const direct = await provider.getRoute(args.tripOrigin, args.tripDestination);
    const leg1 = await provider.getRoute(args.tripOrigin, args.parcelOrigin);
    const leg2 = await provider.getRoute(args.parcelOrigin, args.parcelDestination);
    const leg3 = await provider.getRoute(args.parcelDestination, args.tripDestination);

    const baseDistanceKm = direct?.distanceKm ?? haversineKm(args.tripOrigin, args.tripDestination);
    const baseDurationMinutes = direct?.durationMinutes ?? (baseDistanceKm / 55) * 60;

    const detourDistanceKm =
      (leg1?.distanceKm ?? haversineKm(args.tripOrigin, args.parcelOrigin)) +
      (leg2?.distanceKm ?? haversineKm(args.parcelOrigin, args.parcelDestination)) +
      (leg3?.distanceKm ?? haversineKm(args.parcelDestination, args.tripDestination)) -
      baseDistanceKm;

    const detourMinutes =
      (leg1?.durationMinutes ?? (haversineKm(args.tripOrigin, args.parcelOrigin) / 45) * 60) +
      (leg2?.durationMinutes ?? (haversineKm(args.parcelOrigin, args.parcelDestination) / 45) * 60) +
      (leg3?.durationMinutes ?? (haversineKm(args.parcelDestination, args.tripDestination) / 45) * 60) -
      baseDurationMinutes;

    return {
      routeDistanceKm: baseDistanceKm,
      routeDurationMinutes: baseDurationMinutes,
      detourDistanceKm: Math.max(0, Math.round(detourDistanceKm * 100) / 100),
      detourMinutes: Math.max(0, Math.round(detourMinutes)),
    };
  },
});
