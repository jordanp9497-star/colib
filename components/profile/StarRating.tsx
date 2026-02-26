import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts } from "@/constants/theme";

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
    color: Colors.dark.text,
    marginLeft: 6,
    fontFamily: Fonts.sansSemiBold,
  },
  reviewCount: {
    color: Colors.dark.textSecondary,
    marginLeft: 4,
    fontFamily: Fonts.sans,
  },
});
