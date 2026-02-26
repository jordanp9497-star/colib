import { useEffect, useMemo, useState } from "react";
import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import TripCard from "@/components/TripCard";
import { CrossPlatformMap } from "@/components/maps/CrossPlatformMap";
import type { MapPath, MapPin } from "@/components/maps/CrossPlatformMap.types";
import StarRating from "@/components/profile/StarRating";
import { ActionButton } from "@/components/ui/action-button";
import { Colors, Fonts, Typography } from "@/constants/theme";
import { useSearchFlow } from "@/context/SearchFlowContext";

export default function SearchResultsScreen() {
  const { searchQuery, results, viewMode, setViewMode, newSearch, setSelectedTripId } = useSearchFlow();
  const [selectedMapTripId, setSelectedMapTripId] = useState<string | null>(null);

  useEffect(() => {
    if (!searchQuery) {
      router.replace("/(tabs)" as any);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (!selectedMapTripId) return;
    const stillAvailable = results.some((trip) => String(trip._id) === selectedMapTripId);
    if (!stillAvailable) {
      setSelectedMapTripId(null);
    }
  }, [results, selectedMapTripId]);

  const mapPins = useMemo(() => {
    const pins: MapPin[] = [];
    results.forEach((trip) => {
      pins.push({
        id: `trip-origin-${trip._id}`,
        latitude: trip.originAddress.lat,
        longitude: trip.originAddress.lng,
        title: `Depart ${trip.originAddress.city ?? trip.origin}`,
        color: Colors.dark.primary,
        kind: "trip-origin",
      });
      pins.push({
        id: `trip-destination-${trip._id}`,
        latitude: trip.destinationAddress.lat,
        longitude: trip.destinationAddress.lng,
        title: `Arrivee ${trip.destinationAddress.city ?? trip.destination}`,
        color: Colors.dark.success,
        kind: "trip-destination",
      });
    });
    return pins;
  }, [results]);

  const mapPaths = useMemo(() => {
    const paths: MapPath[] = [];
    results.forEach((trip) => {
      paths.push({
        id: `trip-path-${trip._id}`,
        coordinates: [
          { latitude: trip.originAddress.lat, longitude: trip.originAddress.lng },
          { latitude: trip.destinationAddress.lat, longitude: trip.destinationAddress.lng },
        ],
        color: Colors.dark.primary,
        width: selectedMapTripId === String(trip._id) ? 5 : 3,
      });
    });
    return paths;
  }, [results, selectedMapTripId]);

  const selectedMapTrip = useMemo(() => {
    if (!selectedMapTripId) return null;
    return results.find((trip) => String(trip._id) === selectedMapTripId) ?? null;
  }, [results, selectedMapTripId]);

  const openProposalForTrip = (tripId: string) => {
    setSelectedTripId(tripId);
    router.push({ pathname: "/(tabs)/send", params: { proposalTripId: tripId } } as any);
  };

  const openTrip = (tripId: string) => {
    setSelectedTripId(tripId);
    router.push({ pathname: "/trip/[tripId]", params: { tripId, fromSearch: "1" } } as any);
  };

  const handleMapPinPress = (pinId: string) => {
    if (!pinId.startsWith("trip-")) return;
    const tripId = pinId.split("-").slice(2).join("-");
    if (!tripId) return;
    if (selectedMapTripId === tripId) {
      openTrip(tripId);
      return;
    }
    setSelectedMapTripId(tripId);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Resultats</Text>
          <Text style={styles.subtitle}>{results.length} trajets trouves</Text>
        </View>
        <ActionButton
          label="Nouvelle recherche"
          size="sm"
          variant="secondary"
          onPress={() =>
            void (async () => {
              await newSearch();
              router.replace("/(tabs)" as any);
            })()
          }
        />
      </View>

      <View style={styles.viewModeRow}>
        <TouchableOpacity
          style={[styles.viewModeChip, viewMode === "list" && styles.viewModeChipActive]}
          onPress={() => setViewMode("list")}
        >
          <Text style={[styles.viewModeText, viewMode === "list" && styles.viewModeTextActive]}>Liste</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeChip, viewMode === "map" && styles.viewModeChipActive]}
          onPress={() => setViewMode("map")}
        >
          <Text style={[styles.viewModeText, viewMode === "map" && styles.viewModeTextActive]}>Carte</Text>
        </TouchableOpacity>
      </View>

      {viewMode === "map" ? (
        <ScrollView
          style={styles.mapResultWrap}
          contentContainerStyle={styles.mapResultContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {results.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="car-outline" size={24} color={Colors.dark.textSecondary} />
              <Text style={styles.emptyTitle}>Aucun trajet sur la carte</Text>
              <Text style={styles.emptyText}>Ajustez vos filtres pour trouver des transporteurs.</Text>
            </View>
          ) : (
            <>
              <View style={styles.mapMetaRow}>
                <Text style={styles.resultsMetaText}>{results.length} trajets trouves</Text>
                <Text style={styles.mapHint}>Touchez un trajet pour proposer votre colis</Text>
              </View>
              <CrossPlatformMap
                pins={mapPins}
                paths={mapPaths}
                height={350}
                onPinPress={handleMapPinPress}
                selectedPinId={selectedMapTripId ? `trip-origin-${selectedMapTripId}` : undefined}
              />

              {selectedMapTrip ? (
                <View style={styles.tripActionCard}>
                  <Text style={styles.tripActionTitle}>Trajet selectionne</Text>
                  <Text style={styles.tripActionRoute} numberOfLines={1}>
                    {selectedMapTrip.origin} {" -> "} {selectedMapTrip.destination}
                  </Text>
                  <View style={styles.tripCarrierRow}>
                    {selectedMapTrip.carrierProfile?.profilePhotoUrl ? (
                      <Image
                        source={{ uri: selectedMapTrip.carrierProfile.profilePhotoUrl }}
                        style={styles.tripCarrierAvatar}
                      />
                    ) : (
                      <View style={styles.tripCarrierAvatarFallback}>
                        <Text style={styles.tripCarrierAvatarText}>
                          {(selectedMapTrip.carrierProfile?.name ?? selectedMapTrip.userName)
                            .trim()
                            .charAt(0)
                            .toUpperCase() || "?"}
                        </Text>
                      </View>
                    )}
                    <View style={styles.tripCarrierMeta}>
                      <Text style={styles.tripCarrierName} numberOfLines={1}>
                        {selectedMapTrip.carrierProfile?.name ?? selectedMapTrip.userName}
                      </Text>
                      <StarRating
                        rating={selectedMapTrip.carrierProfile?.averageRating}
                        totalReviews={selectedMapTrip.carrierProfile?.totalReviews ?? 0}
                        size={12}
                        color="#FDE68A"
                      />
                    </View>
                  </View>
                  <Text style={styles.tripActionMeta}>
                    Espace {selectedMapTrip.availableSpace} - Base {selectedMapTrip.price} EUR
                  </Text>
                  <View style={styles.tripActionButtons}>
                    <TouchableOpacity
                      style={styles.tripActionPrimary}
                      onPress={() => openProposalForTrip(String(selectedMapTrip._id))}
                    >
                      <Text style={styles.tripActionPrimaryText}>Proposer votre colis</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.tripActionSecondary} onPress={() => openTrip(String(selectedMapTrip._id))}>
                      <Text style={styles.tripActionSecondaryText}>Voir le trajet</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View style={styles.listTripItem}>
              <TouchableOpacity activeOpacity={0.86} onPress={() => openTrip(String(item._id))}>
                <TripCard trip={item} />
              </TouchableOpacity>
              <View style={styles.listTripActions}>
                <TouchableOpacity style={styles.listTripPrimary} onPress={() => openProposalForTrip(String(item._id))}>
                  <Text style={styles.listTripPrimaryText}>Proposer votre colis</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.listTripSecondary} onPress={() => openTrip(String(item._id))}>
                  <Text style={styles.listTripSecondaryText}>Voir le trajet</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.center}>
          <Ionicons name="car-outline" size={24} color={Colors.dark.textSecondary} />
          <Text style={styles.emptyTitle}>Aucun trajet trouve</Text>
          <Text style={styles.emptyText}>Elargissez la zone ou retirez les filtres pour voir plus d&apos;annonces.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingTop: 56,
  },
  header: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 24,
    color: Colors.dark.text,
    fontFamily: Fonts.displaySemiBold,
  },
  subtitle: {
    marginTop: 2,
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
  viewModeRow: {
    marginTop: 12,
    marginHorizontal: 20,
    flexDirection: "row",
    gap: 6,
    borderRadius: 999,
    backgroundColor: Colors.dark.surfaceMuted,
    padding: 4,
    alignSelf: "flex-start",
  },
  viewModeChip: {
    borderRadius: 999,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "transparent",
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  viewModeChipActive: {
    backgroundColor: Colors.dark.primaryLight,
    borderColor: Colors.dark.primary,
  },
  viewModeText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  viewModeTextActive: {
    color: Colors.dark.text,
  },
  mapResultWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 96,
  },
  mapResultContent: {
    gap: 10,
    paddingBottom: 6,
  },
  mapMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  mapHint: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  resultsMetaText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  tripActionCard: {
    borderRadius: 12,
    borderWidth: 0,
    backgroundColor: Colors.dark.surface,
    padding: 12,
    gap: 6,
  },
  tripActionTitle: {
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  tripActionRoute: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
  tripCarrierRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tripCarrierAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.dark.surfaceMuted,
  },
  tripCarrierAvatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  tripCarrierAvatarText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  tripCarrierMeta: {
    flex: 1,
    minWidth: 0,
  },
  tripCarrierName: {
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
  },
  tripActionMeta: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  tripActionButtons: {
    marginTop: 6,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  tripActionPrimary: {
    borderRadius: 10,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  tripActionPrimaryText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  tripActionSecondary: {
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  tripActionSecondaryText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  list: {
    padding: 20,
    paddingBottom: 110,
    gap: 10,
  },
  listTripItem: {
    gap: 8,
  },
  listTripActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  listTripPrimary: {
    borderRadius: 10,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  listTripPrimaryText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  listTripSecondary: {
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceMuted,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  listTripSecondaryText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    ...Typography.h1,
    color: Colors.dark.text,
    marginTop: 10,
    marginBottom: 8,
    fontFamily: Fonts.displaySemiBold,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    fontFamily: Fonts.sans,
  },
});
