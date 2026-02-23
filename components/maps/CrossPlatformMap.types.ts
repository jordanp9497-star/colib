export type MapPin = {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
  color?: string;
};

export type MapPath = {
  id: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  color?: string;
  width?: number;
};

export type CrossPlatformMapProps = {
  pins: MapPin[];
  paths?: MapPath[];
  height?: number;
};
