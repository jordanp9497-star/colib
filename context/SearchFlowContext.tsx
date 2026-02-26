import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { removePersistedItem, removeSessionItem } from "@/utils/clientStorage";
import { FILTER_STORAGE_KEY, LAST_SEARCH_STORAGE_KEY } from "@/constants/searchFlow";
import type { GeocodedAddress } from "@/packages/shared/maps";

type SearchStatus = "idle" | "matching" | "results";
type SearchViewMode = "list" | "map";

export type TripListItem = {
  _id: string;
  origin: string;
  destination: string;
  date: string;
  availableSpace: "petit" | "moyen" | "grand";
  price: number;
  description?: string;
  phone?: string;
  userName: string;
  carrierProfile?: {
    name: string;
    profilePhotoUrl: string | null;
    averageRating: number | null;
    totalReviews: number;
  };
  originAddress: { lat: number; lng: number; label?: string; city?: string; postalCode?: string };
  destinationAddress: { lat: number; lng: number; label?: string; city?: string; postalCode?: string };
  windowStartTs?: number;
  status: string;
};

export type PersistedSearch = {
  originZone: GeocodedAddress | null;
  destinationZone: GeocodedAddress | null;
  dateValue: string;
  showAdvancedFilters: boolean;
  searchedAt: number;
  resultCount: number;
};

export type SearchQuery = {
  originZone: GeocodedAddress | null;
  destinationZone: GeocodedAddress | null;
  dateValue: string;
  showAdvancedFilters: boolean;
};

type SearchFlowContextValue = {
  status: SearchStatus;
  searchQuery: SearchQuery | null;
  results: TripListItem[];
  selectedTripId: string | null;
  viewMode: SearchViewMode;
  beginSearch: (query: SearchQuery) => void;
  completeSearch: (nextResults: TripListItem[]) => void;
  setSelectedTripId: (tripId: string | null) => void;
  setViewMode: (viewMode: SearchViewMode) => void;
  newSearch: () => Promise<void>;
};

const SearchFlowContext = createContext<SearchFlowContextValue | null>(null);

export function SearchFlowProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [searchQuery, setSearchQuery] = useState<SearchQuery | null>(null);
  const [results, setResults] = useState<TripListItem[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<SearchViewMode>("list");

  const beginSearch = useCallback((query: SearchQuery) => {
    setSearchQuery(query);
    setStatus("matching");
    setResults([]);
    setSelectedTripId(null);
  }, []);

  const completeSearch = useCallback((nextResults: TripListItem[]) => {
    setResults(nextResults);
    setStatus("results");
  }, []);

  const handleNewSearch = useCallback(async () => {
    setStatus("idle");
    setSearchQuery(null);
    setResults([]);
    setSelectedTripId(null);
    setViewMode("list");
    await removePersistedItem(FILTER_STORAGE_KEY);
    await removePersistedItem(LAST_SEARCH_STORAGE_KEY);
    removeSessionItem(LAST_SEARCH_STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({
      status,
      searchQuery,
      results,
      selectedTripId,
      viewMode,
      beginSearch,
      completeSearch,
      setSelectedTripId,
      setViewMode,
      newSearch: handleNewSearch,
    }),
    [beginSearch, completeSearch, handleNewSearch, results, searchQuery, selectedTripId, status, viewMode]
  );

  return <SearchFlowContext.Provider value={value}>{children}</SearchFlowContext.Provider>;
}

export function useSearchFlow() {
  const context = useContext(SearchFlowContext);
  if (!context) {
    throw new Error("useSearchFlow must be used within SearchFlowProvider");
  }
  return context;
}
