import { useAction } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { AddressSuggestion, GeocodedAddress } from "@/packages/shared/maps";

export function useAddressAutocomplete(query: string, delayMs = 300) {
  const autocomplete = useAction(api.maps.autocompleteAddress);
  const geocodePlace = useAction(api.maps.geocodePlace);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await autocomplete({ input: trimmed, countryCode: "fr", limit: 6 });
        setSuggestions(result);
      } catch {
        setError("Impossible de charger les suggestions");
      } finally {
        setLoading(false);
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [autocomplete, delayMs, query]);

  const resolveSuggestion = useMemo(() => {
    return async (suggestion: AddressSuggestion): Promise<GeocodedAddress | null> => {
      try {
        return await geocodePlace({ placeId: suggestion.placeId });
      } catch {
        return null;
      }
    };
  }, [geocodePlace]);

  return {
    suggestions,
    loading,
    error,
    resolveSuggestion,
  };
}
