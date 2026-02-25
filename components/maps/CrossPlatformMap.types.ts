export type MapPin = {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
  color?: string;
  kind?: "trip-origin" | "trip-destination" | "parcel" | "cluster";
};

export type MapPath = {
  id: string;
  coordinates: { latitude: number; longitude: number }[];
  color?: string;
  width?: number;
};

export type CrossPlatformMapProps = {
  pins: MapPin[];
  paths?: MapPath[];
  height?: number;
  onPinPress?: (pinId: string) => void;
  selectedPinId?: string | null;
};
