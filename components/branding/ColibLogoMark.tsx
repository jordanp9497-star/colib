import { StyleSheet, View } from "react-native";

type ColibLogoMarkProps = {
  size?: number;
  color?: string;
  backgroundColor?: string;
};

export function ColibLogoMark({
  size = 44,
  color = "#2F80ED",
  backgroundColor = "#161D24",
}: ColibLogoMarkProps) {
  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.26),
          backgroundColor,
        },
      ]}
    >
      <View
        style={[
          styles.ring,
          {
            width: Math.round(size * 0.76),
            height: Math.round(size * 0.76),
            borderRadius: Math.round(size * 0.38),
            borderWidth: Math.max(2, Math.round(size * 0.12)),
            borderColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.cut,
          {
            width: Math.round(size * 0.24),
            height: Math.round(size * 0.4),
            right: Math.round(size * 0.05),
            backgroundColor,
          },
        ]}
      />

      <View
        style={[
          styles.parcel,
          {
            width: Math.round(size * 0.34),
            height: Math.round(size * 0.34),
            borderRadius: Math.max(3, Math.round(size * 0.08)),
            borderColor: color,
          },
        ]}
      >
        <View
          style={[
            styles.notch,
            {
              borderRightColor: color,
              borderTopWidth: Math.round(size * 0.07),
              borderRightWidth: Math.round(size * 0.07),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ring: {
    position: "absolute",
  },
  cut: {
    position: "absolute",
    top: "30%",
  },
  parcel: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
    borderWidth: 2,
    backgroundColor: "transparent",
    transform: [{ rotate: "-6deg" }],
  },
  notch: {
    width: 0,
    height: 0,
    borderTopColor: "transparent",
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
});
