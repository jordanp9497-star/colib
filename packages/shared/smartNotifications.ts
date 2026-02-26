export type DriverNotificationSettings = {
  notifyRadiusKm: number;
  minPrice?: number;
  urgentOnly: boolean;
  maxPushPerHour: number;
};

export const DEFAULT_DRIVER_NOTIFICATION_SETTINGS: DriverNotificationSettings = {
  notifyRadiusKm: 5,
  minPrice: undefined,
  urgentOnly: false,
  maxPushPerHour: 5,
};

export function normalizeDriverNotificationSettings(
  input?: Partial<DriverNotificationSettings> | null
): DriverNotificationSettings {
  const radius = Number.isFinite(input?.notifyRadiusKm)
    ? Math.max(1, Math.min(30, Math.round(input!.notifyRadiusKm!)))
    : DEFAULT_DRIVER_NOTIFICATION_SETTINGS.notifyRadiusKm;
  const minPrice = Number.isFinite(input?.minPrice)
    ? Math.max(0, Number(input!.minPrice))
    : undefined;
  const maxPushPerHour = Number.isFinite(input?.maxPushPerHour)
    ? Math.max(1, Math.min(20, Math.round(input!.maxPushPerHour!)))
    : DEFAULT_DRIVER_NOTIFICATION_SETTINGS.maxPushPerHour;

  return {
    notifyRadiusKm: radius,
    minPrice,
    urgentOnly: Boolean(input?.urgentOnly),
    maxPushPerHour,
  };
}

export function canSendPushInCurrentHour(args: {
  sentInLastHour: number;
  maxPushPerHour: number;
}) {
  return args.sentInLastHour < Math.max(1, args.maxPushPerHour);
}
