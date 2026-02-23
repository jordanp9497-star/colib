import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface StarRatingProps {
  rating: number | null | undefined;
  totalReviews?: number;
  size?: number;
  color?: string;
}

export default function StarRating({
  rating,
  totalReviews = 0,
  size = 16,
  color = "#F59E0B",
}: StarRatingProps) {
  const displayRating = rating ?? 0;

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={displayRating >= star ? "star" : displayRating >= star - 0.5 ? "star-half" : "star-outline"}
          size={size}
          color={color}
          style={{ marginRight: 1 }}
        />
      ))}
      {rating != null && (
        <Text style={[styles.text, { fontSize: size - 2 }]}>
          {rating.toFixed(1)}
        </Text>
      )}
      {totalReviews > 0 && (
        <Text style={[styles.reviewCount, { fontSize: size - 3 }]}>
          ({totalReviews} avis)
        </Text>
      )}
      {totalReviews === 0 && rating == null && (
        <Text style={[styles.reviewCount, { fontSize: size - 3 }]}>
          Aucun avis
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    fontWeight: "600",
    color: "#1E293B",
    marginLeft: 6,
  },
  reviewCount: {
    color: "#94A3B8",
    marginLeft: 4,
  },
});
