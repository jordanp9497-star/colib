import { useRef } from "react";
import { Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type SwipeAction = {
  label: string;
  color: string;
  textColor?: string;
  onPress: () => void;
};

const ACTION_WIDTH = 96;

export function SwipeActionRow({
  children,
  actions,
}: {
  children: React.ReactNode;
  actions: SwipeAction[];
}) {
  const maxSwipe = -(actions.length * ACTION_WIDTH);
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dy) < 8,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx > 0) return;
        translateX.setValue(Math.max(maxSwipe, gesture.dx));
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldOpen = gesture.dx < maxSwipe / 3;
        Animated.spring(translateX, {
          toValue: shouldOpen ? maxSwipe : 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      },
    })
  ).current;

  return (
    <View style={styles.wrap}>
      <View style={styles.actionsWrap} pointerEvents="box-none">
        {actions.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={[styles.actionButton, { backgroundColor: action.color }]}
            activeOpacity={0.85}
            onPress={() => {
              action.onPress();
              Animated.timing(translateX, { toValue: 0, duration: 120, useNativeDriver: true }).start();
            }}
          >
            <Text style={[styles.actionText, action.textColor ? { color: action.textColor } : null]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
  },
  actionsWrap: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "stretch",
    gap: 8,
    paddingBottom: 12,
  },
  actionButton: {
    width: ACTION_WIDTH,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
});
