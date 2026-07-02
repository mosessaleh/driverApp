export interface DriverStatusUpdatePayload {
  isOnline?: boolean;
  currentRideId: number | null;
  isBusy: boolean;
  rideAccepted: number | null;
}

export interface RideOfferPayload {
  type?: string;
  offerType?: string;
  scheduled?: boolean;
  rideId: number;
  rideData: {
    id: number;
    pickupAddress: string;
    dropoffAddress: string;
    stopAddress?: string | null;
    price: number;
    distanceKm: number;
    riderName?: string;
    startLatLon?: { lat: number; lon: number } | null;
    stopLatLon?: { lat: number; lon: number } | null;
    endLatLon?: { lat: number; lon: number } | null;
    vehicleType?: { title: string; capacity: number };
    [key: string]: unknown;
  };
  timestamp: number;
  timeoutMs?: number;
}

export interface RideOfferTimeoutPayload {
  rideId: number;
}

export interface RideOfferRejectedPayload {
  rideId: number;
}

export interface RideAcceptedPayload {
  rideId: number;
}

export interface RideAcceptFailedPayload {
  rideId: number;
  reason: string;
}

export interface ScheduledOfferResultPayload {
  rideId: number;
  selected: boolean;
  message?: string;
  pickupTime?: string;
  rideData?: Record<string, unknown>;
}

export interface ScheduledOfferAcknowledgedPayload {
  rideId: number;
}

export interface ScheduledUpcomingOffersUpdatePayload {
  pendingCount: number;
  pendingOffers: Array<{
    rideId: number;
    pickupTime?: string | null;
    createdAt?: number | string;
    timeoutMs?: number;
    expiresAt?: number | string;
    timeLeftMs?: number;
    rideData?: Record<string, unknown>;
  }>;
}

export interface RideCancelledPayload {
  rideId: number;
}

export interface NewMessagePayload {
  message: string;
  sender: string;
  timestamp: string;
}

export interface PickupProximityPayload {
  rideId: number;
  distanceMeters: number;
  countdownStart: number;
  countdownDuration: number;
}

export interface PickupCountdownExpiredPayload {
  rideId: number;
}

export interface ScheduledLateWarningPayload {
  rideId: number;
  lateMinutes: number;
  remainingMinutes: number;
  etaMinutes?: number;
  minutesBeforePickup?: number;
  pickupTime?: string;
}

export type SocketEventCallback<T = unknown> = (data: T) => void;
