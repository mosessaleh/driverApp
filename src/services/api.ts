import { getApiBaseUrl } from '../config/network';
import { ScheduledPendingOffer, OpenRide } from '../types';
import {
  getRefreshToken,
  setRefreshToken,
  getAuthToken,
  setAuthToken,
  removeRefreshToken,
  removeAuthToken,
} from './secureStorage';

const API_BASE_URL = getApiBaseUrl();

let onTokenRefreshed: ((token: string, refreshToken: string) => void) | null = null;
let getDeviceIdFn: (() => Promise<string | null>) | null = null;

export const setTokenRefreshCallback = (cb: (token: string, refreshToken: string) => void) => {
  onTokenRefreshed = cb;
};

export const setDeviceIdProvider = (fn: () => Promise<string | null>) => {
  getDeviceIdFn = fn;
};

export type DriverLoginWarningResponse = {
  requiresConfirmation: true;
  warningCode: 'OUTSIDE_SCHEDULE' | string;
  warning?: string;
  message: string;
  schedule?: any;
  redistributionPolicy?: {
    maxHours: number;
    graceMinutes: number;
    affectedRideCount: number;
    affectedRideIds: number[];
  };
};

export type DriverLoginSuccessResponse = {
  success: true;
  requiresConfirmation?: false;
  message: string;
  token: string;
  accessToken?: string;
  refreshToken?: string;
  bannedUntil?: string | null;
  restrictedOffers?: boolean;
  restrictedOffersUntil?: string | null;
  driver: {
    id: number;
    name: string;
    car: string;
    rating?: number;
    fiveStarCount?: number;
    vehicleTypeId?: number;
  };
  shiftId: number;
  shiftStartTime: string | null;
  schedule?: any;
  loginPolicy?: {
    outsideSchedule: boolean;
    redistributionPolicy?: {
      maxHours: number;
      graceMinutes: number;
    };
    releasedScheduledRides?: {
      count: number;
      rideIds: number[];
      rides: Array<{ id: number; pickupTime: string | null }>;
    };
  };
};

export type DriverLoginResponse = DriverLoginSuccessResponse | DriverLoginWarningResponse;

export const isDriverLoginSuccessResponse = (
  response: DriverLoginResponse,
): response is DriverLoginSuccessResponse => {
  const candidate = response as Partial<DriverLoginSuccessResponse>;

  return Boolean(
    candidate?.success === true &&
    typeof candidate?.token === 'string' &&
    candidate?.driver &&
    typeof candidate.driver.id === 'number' &&
    typeof candidate?.shiftId === 'number',
  );
};

class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const isRetryableHttpError = (status: number): boolean => {
  if (status === 429) return false;
  if (status === 408) return true;
  if (status >= 400 && status < 500) return status === 401;
  return true;
};

let isRefreshing = false;
let refreshPromise: Promise<{ token: string; refreshToken: string } | null> | null = null;

const refreshAccessToken = async (): Promise<{ token: string; refreshToken: string } | null> => {
  if (isRefreshing && refreshPromise) return refreshPromise;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const storedRefreshToken = await getRefreshToken();
      if (!storedRefreshToken) return null;

      const response = await fetch(`${API_BASE_URL}/api/driver/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      const newToken = data.accessToken || data.token;
      const newRefresh = data.refreshToken;

      if (!newToken) return null;

      await setAuthToken(newToken);
      if (newRefresh) {
        await setRefreshToken(newRefresh);
      }

      if (onTokenRefreshed) {
        onTokenRefreshed(newToken, newRefresh || storedRefreshToken);
      }

      return { token: newToken, refreshToken: newRefresh || storedRefreshToken };
    } catch {
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

const retry = async (fn: () => Promise<any>, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) {
      // Try refresh on 401
      if (error.status === 401 && retries === 3) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return retry(fn, retries - 1, delay);
        }
        await removeAuthToken();
        await removeRefreshToken();
      }

      if (!isRetryableHttpError(error.status)) {
        throw error;
      }
    }
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const api = {
  post: async (endpoint: string, data: any, token?: string) => {
    return retry(async () => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      if (getDeviceIdFn) {
        const deviceId = await getDeviceIdFn();
        if (deviceId) headers['X-Device-Id'] = deviceId;
      }
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorMessage = `API Error ${response.status}: ${response.statusText || errorText}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If not JSON, use the text as is
        }
        throw new HttpError(errorMessage, response.status);
      }
      return response.json();
    });
  },
  get: async (endpoint: string, token?: string) => {
    return retry(async () => {
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      if (getDeviceIdFn) {
        const deviceId = await getDeviceIdFn();
        if (deviceId) headers['X-Device-Id'] = deviceId;
      }
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers,
      });
      if (!response.ok) {
        throw new HttpError(
          `API Error: ${response.status} ${response.statusText}`,
          response.status,
        );
      }
      return response.json();
    });
  },
  put: async (endpoint: string, data: any, token?: string) => {
    return retry(async () => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      if (getDeviceIdFn) {
        const deviceId = await getDeviceIdFn();
        if (deviceId) headers['X-Device-Id'] = deviceId;
      }
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorMessage = `API Error ${response.status}: ${response.statusText || errorText}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If not JSON, use the text as is
        }
        throw new HttpError(errorMessage, response.status);
      }
      return response.json();
    });
  },
  // Add other methods as needed
};

export const loginDriver = async (
  username: string,
  password: string,
  startKM: number,
  confirmOutsideSchedule: boolean = false,
  deviceId?: string | null,
  deviceInfo?: string | null,
): Promise<DriverLoginResponse> => {
  return api.post('/api/driver/login', {
    username,
    password,
    startKM,
    confirmOutsideSchedule,
    deviceId,
    deviceInfo,
  });
};

export const getAvailableRides = async (token: string) => {
  return api.get('/api/bookings/available', token);
};

export const getRide = async (rideId: string, token: string) => {
  return api.get(`/api/driver/rides/${rideId}`, token);
};

export const acceptRide = async (rideId: string, token: string) => {
  return api.post(`/api/bookings/${rideId}/accept`, {}, token);
};

export const startRide = async (rideId: string, token: string) => {
  return api.post(`/api/bookings/${rideId}/start`, {}, token);
};

export const endRide = async (rideId: string, token: string) => {
  return api.post(`/api/bookings/${rideId}/end`, {}, token);
};

export const toggleDriverOnline = async (online: boolean, token: string) => {
  return api.post('/api/driver/status', { online }, token);
};

export const toggleDriverBusy = async (busy: boolean, token: string) => {
  return api.post('/api/driver/status', { busy, busyMode: busy ? 'manual' : null }, token);
};

export const getDriverStatus = async (token: string) => {
  return api.get('/api/driver/status', token);
};

export const getDriverSchedule = async (token: string) => {
  return api.get('/api/driver/schedule', token);
};

export const updateDriverScheduleTemplate = async (
  token: string,
  days: Array<{
    dayOfWeek: number;
    windows: Array<{
      start?: string;
      end?: string;
      startMinute?: number;
      endMinute?: number;
      isActive?: boolean;
    }>;
  }>,
) => {
  return api.post(
    '/api/driver/schedule',
    {
      action: 'setTemplate',
      days,
    },
    token,
  );
};

export const updateDriverSchedulePreferences = async (
  token: string,
  payload: {
    maxDailyMinutes?: number;
    maxWeeklyMinutes?: number;
    minRestMinutes?: number;
    lockMinutesBeforeStart?: number;
    allowEmergencyOverride?: boolean;
  },
) => {
  return api.post(
    '/api/driver/schedule',
    {
      action: 'setPreferences',
      ...payload,
    },
    token,
  );
};

export const upsertDriverScheduleException = async (
  token: string,
  payload: {
    date: string;
    type: 'OFF' | 'LEAVE' | 'SICK' | 'CUSTOM' | 'EMERGENCY';
    start?: string;
    end?: string;
    startMinute?: number;
    endMinute?: number;
    note?: string;
  },
) => {
  return api.post(
    '/api/driver/schedule',
    {
      action: 'setException',
      ...payload,
    },
    token,
  );
};

export const deleteDriverScheduleException = async (token: string, date: string) => {
  return api.post(
    '/api/driver/schedule',
    {
      action: 'deleteException',
      date,
    },
    token,
  );
};

export const applyDriverScheduleSuggestions = async (token: string, daysBack: number = 42) => {
  return api.post(
    '/api/driver/schedule',
    {
      action: 'applySuggestions',
      daysBack,
    },
    token,
  );
};

export const updateDriverLocation = async (
  latitude: number,
  longitude: number,
  token: string,
  timestamp?: string,
) => {
  return api.post('/api/driver/location-update', { latitude, longitude, timestamp }, token);
};

export const logoutDriver = async (token: string) => {
  return api.post('/api/auth/logout', {}, token);
};

export const refreshDriverToken = async (refreshToken: string) => {
  return api.post('/api/driver/refresh-token', { refreshToken });
};

export const getDriverProfile = async (driverId: string, token: string) => {
  return api.get(`/api/drivers/${driverId}`, token);
};

export const getDriverHistory = async (
  token: string,
  startDate?: string,
  endDate?: string,
  allDrivers: boolean = false,
  includeActive: boolean = false,
) => {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (allDrivers) params.append('all', 'true');
  if (includeActive) params.append('includeActive', 'true');
  const query = params.toString() ? `?${params.toString()}` : '';
  return api.get(`/api/driver/history${query}`, token);
};

export const getDriverCompletedShifts = async (token: string, limit: number = 120) => {
  const params = new URLSearchParams();
  if (Number.isFinite(limit) && limit > 0) {
    params.append('limit', String(Math.trunc(limit)));
  }
  const query = params.toString() ? `?${params.toString()}` : '';
  return api.get(`/api/driver/shifts${query}`, token);
};

export const getDriverUpcoming = async (token: string) => {
  return api.get('/api/driver/upcoming', token);
};

type ScheduledPendingOfferRaw = {
  rideId?: number | string;
  stage?: number | string;
  pickupTime?: string | null;
  expiresAt?: number | string | null;
  timeLeftMs?: number | string | null;
  rideData?: {
    id?: number | string;
    pickupAddress?: string;
    dropoffAddress?: string;
    stopAddress?: string | null;
    price?: number | string;
    distanceKm?: number | string;
    riderName?: string;
    paymentMethod?: string;
    startLatLon?: { lat?: number; lon?: number } | null;
    stopLatLon?: { lat?: number; lon?: number } | null;
    endLatLon?: { lat?: number; lon?: number } | null;
    vehicleTypeId?: number | string;
    pickupTime?: string | null;
  } | null;
};

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeLatLon = (
  value: { lat?: number; lon?: number } | null | undefined,
): { lat: number; lon: number } | null => {
  if (!value) return null;

  const lat = toFiniteNumber(value.lat, Number.NaN);
  const lon = toFiniteNumber(value.lon, Number.NaN);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return { lat, lon };
};

export const normalizeScheduledPendingOffers = (
  pendingOffers: ScheduledPendingOfferRaw[] | undefined | null,
): ScheduledPendingOffer[] => {
  if (!Array.isArray(pendingOffers)) return [];

  const normalized = pendingOffers
    .map((offer): ScheduledPendingOffer | null => {
      const rideId = toFiniteNumber(offer?.rideId, 0);
      if (rideId <= 0) return null;

      const expiresAtRaw = offer?.expiresAt;
      const expiresAtMs =
        typeof expiresAtRaw === 'number'
          ? expiresAtRaw
          : new Date(typeof expiresAtRaw === 'string' ? expiresAtRaw : '').getTime();

      const rideData = offer?.rideData ?? {};
      const pickupTime = offer?.pickupTime || rideData.pickupTime || null;

      return {
        rideId,
        stage: toFiniteNumber(offer?.stage, 1),
        pickupTime,
        expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : 0,
        timeLeftMs: Math.max(0, toFiniteNumber(offer?.timeLeftMs, 0)),
        rideData: {
          id: toFiniteNumber(rideData.id, rideId),
          pickupAddress: rideData.pickupAddress || '',
          dropoffAddress: rideData.dropoffAddress || '',
          stopAddress: rideData.stopAddress || null,
          price: toFiniteNumber(rideData.price, 0),
          distanceKm: toFiniteNumber(rideData.distanceKm, 0),
          riderName: rideData.riderName || '',
          paymentMethod: rideData.paymentMethod || undefined,
          startLatLon: normalizeLatLon(rideData.startLatLon),
          stopLatLon: normalizeLatLon(rideData.stopLatLon),
          endLatLon: normalizeLatLon(rideData.endLatLon),
          vehicleTypeId: toFiniteNumber(rideData.vehicleTypeId, 0),
          pickupTime,
        },
      };
    })
    .filter((offer): offer is ScheduledPendingOffer => Boolean(offer));

  return normalized.sort((a, b) => a.expiresAtMs - b.expiresAtMs);
};

export const normalizeOpenRides = (openRides: any[] | undefined | null): OpenRide[] => {
  if (!Array.isArray(openRides)) return [];

  return openRides
    .map((ride): OpenRide | null => {
      const id = toFiniteNumber(ride?.id, 0);
      if (id <= 0) return null;

      return {
        id,
        pickupAddress: ride?.pickupAddress || '',
        dropoffAddress: ride?.dropoffAddress || '',
        stopAddress: ride?.stopAddress || null,
        price: toFiniteNumber(ride?.price, 0),
        distanceKm: toFiniteNumber(ride?.distanceKm, 0),
        durationMin: ride?.durationMin != null ? toFiniteNumber(ride.durationMin, 0) : null,
        riderName: ride?.riderName || '',
        startLatLon: normalizeLatLon(ride?.startLatLon),
        stopLatLon: normalizeLatLon(ride?.stopLatLon),
        endLatLon: normalizeLatLon(ride?.endLatLon),
        vehicleTypeId: toFiniteNumber(ride?.vehicleTypeId, 0),
        paymentMethod: ride?.paymentMethod || undefined,
        createdAt: ride?.createdAt || undefined,
      };
    })
    .filter((ride): ride is OpenRide => Boolean(ride));
};

export const endShift = async (endKM: number, token: string) => {
  return api.post('/api/driver/end-shift', { endKM }, token);
};

export const requestDriverPasswordReset = async (email: string) => {
  return api.post('/api/driver/request-reset', { email });
};

export const updatePushToken = async (pushToken: string, token: string) => {
  return api.post('/api/driver/push-token', { pushToken }, token);
};

export const getRidePreferences = async (token: string) => {
  return api.get('/api/driver/ride-preferences', token);
};

export const saveRidePreferences = async (
  minDistanceKm: number,
  minTimeMinutes: number,
  token: string,
) => {
  return api.post('/api/driver/ride-preferences', { minDistanceKm, minTimeMinutes }, token);
};

export const getAnalytics = async (token: string, period: string = 'month') => {
  try {
    const data = await api.get(`/api/driver/analytics?period=${period}`, token);
    return {
      ok: true,
      status: 200,
      data,
    };
  } catch (error: any) {
    console.error('Analytics fetch error:', error);
    return {
      ok: false,
      status: error.status || 0,
      data: null,
    };
  }
};
