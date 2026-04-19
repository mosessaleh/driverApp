export type DriverNotificationPayload = {
  type?: string;
  screen?: string;
  route?: string;
  rideId?: number | string;
  bookingId?: number | string;
  id?: number | string;
};

export type DriverKnownScreen =
  | 'dashboard'
  | 'history'
  | 'upcoming'
  | 'profile'
  | 'settings'
  | 'schedule'
  | 'analytics'
  | 'ride-details';

export type DriverNavigationTarget =
  | '/dashboard'
  | '/history'
  | '/upcoming'
  | '/profile'
  | '/settings'
  | '/schedule'
  | '/analytics'
  | { pathname: '/ride-details'; params: { id: string } };

export const parseNotificationPayload = (value: unknown): DriverNotificationPayload => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return value as DriverNotificationPayload;
};

export const normalizeScreenName = (value: unknown): DriverKnownScreen | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/^\/+/, '').toLowerCase();

  if (normalized === 'dashboard') return 'dashboard';
  if (normalized === 'history') return 'history';
  if (normalized === 'upcoming') return 'upcoming';
  if (normalized === 'profile') return 'profile';
  if (normalized === 'settings') return 'settings';
  if (normalized === 'schedule') return 'schedule';
  if (normalized === 'analytics') return 'analytics';
  if (normalized === 'ride-details' || normalized === 'ridedetails') return 'ride-details';

  return null;
};

export const parseRideId = (payload: DriverNotificationPayload): string | null => {
  const candidate = payload.rideId ?? payload.bookingId ?? payload.id;
  const parsed = Number(candidate);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return String(parsed);
};

export const resolveNotificationScreen = (payload: DriverNotificationPayload): DriverKnownScreen => {
  const requestedScreen = normalizeScreenName(payload.screen ?? payload.route);
  if (requestedScreen) {
    return requestedScreen;
  }

  const notificationType = String(payload.type || '').trim().toLowerCase();

  if (
    notificationType === 'newride' ||
    notificationType === 'rideoffer' ||
    notificationType === 'rideaccepted' ||
    notificationType === 'ridecancelled' ||
    notificationType === 'ridestatusupdate' ||
    notificationType === 'chatmessage' ||
    notificationType === 'message'
  ) {
    return 'dashboard';
  }

  if (
    notificationType === 'scheduledlatewarning' ||
    notificationType === 'upcomingride' ||
    notificationType === 'scheduledoffer'
  ) {
    return 'upcoming';
  }

  return 'dashboard';
};

export const getNavigationTarget = (
  screen: DriverKnownScreen,
  payload: DriverNotificationPayload
): DriverNavigationTarget => {
  if (screen === 'dashboard') {
    return '/dashboard';
  }

  if (screen === 'history') {
    return '/history';
  }

  if (screen === 'upcoming') {
    return '/upcoming';
  }

  if (screen === 'profile') {
    return '/profile';
  }

  if (screen === 'settings') {
    return '/settings';
  }

  if (screen === 'schedule') {
    return '/schedule';
  }

  if (screen === 'analytics') {
    return '/analytics';
  }

  const rideId = parseRideId(payload);
  if (rideId) {
    return { pathname: '/ride-details', params: { id: rideId } };
  }

  return '/dashboard';
};
