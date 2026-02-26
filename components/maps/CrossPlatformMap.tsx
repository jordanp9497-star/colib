import { Platform } from "react-native";
import type { CrossPlatformMapProps } from "./CrossPlatformMap.types";

const Impl =
  Platform.OS === "web"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./CrossPlatformMap.web").CrossPlatformMap
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./CrossPlatformMap.native").CrossPlatformMap;

export function CrossPlatformMap(props: CrossPlatformMapProps) {
  return <Impl {...props} />;
}
