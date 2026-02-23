export interface AddressSuggestion {
  placeId: string;
  label: string;
  mainText: string;
  secondaryText?: string;
}

export interface GeocodedAddress {
  placeId: string;
  label: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
  lat: number;
  lng: number;
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RouteResult {
  polyline?: string;
  distanceKm: number;
  durationMinutes: number;
  points?: RoutePoint[];
}

export interface AutocompleteOptions {
  countryCode?: string;
  sessionToken?: string;
  limit?: number;
}

export interface RoutingOptions {
  waypoints?: RoutePoint[];
}

export interface MapsProvider {
  autocompleteAddress(
    input: string,
    opts?: AutocompleteOptions
  ): Promise<AddressSuggestion[]>;
  geocodePlace(placeId: string): Promise<GeocodedAddress | null>;
  getRoute(
    origin: RoutePoint,
    destination: RoutePoint,
    opts?: RoutingOptions
  ): Promise<RouteResult | null>;
}
