import { Platform } from "react-native";
import type { CrossPlatformMapProps } from "./CrossPlatformMap.types";

const Impl =
  Platform.OS === "web"
    ? require("./CrossPlatformMap.web").CrossPlatformMap
    : require("./CrossPlatformMap.native").CrossPlatformMap;

export function CrossPlatformMap(props: CrossPlatformMapProps) {
  return <Impl {...props} />;
}
