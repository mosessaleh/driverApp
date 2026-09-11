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

export interface OpenRide {
  id: number;
  pickupAddress: string;
  dropoffAddress: string;
  stopAddress?: string | null;
  price: number;
  distanceKm: number;
  durationMin?: number | null;
  riderName?: string;
  startLatLon?: { lat: number; lon: number } | null;
  stopLatLon?: { lat: number; lon: number } | null;
  endLatLon?: { lat: number; lon: number } | null;
  vehicleTypeId?: number;
  paymentMethod?: string;
  createdAt?: string;
}

export interface RideProposalPayload {
  type?: string;
  rideId: number;
  rideData: {
    id: number;
    pickupAddress: string;
    dropoffAddress: string;
    price: number;
    distanceKm: number;
    riderName?: string;
    startLatLon?: { lat: number; lon: number } | null;
    endLatLon?: { lat: number; lon: number } | null;
    vehicleTypeId?: number;
    paymentMethod?: string;
    [key: string]: unknown;
  };
  distanceKm: number;
  etaMinutes: number;
  timestamp: number;
  timeoutMs?: number;
}

export interface RideProposalTimeoutPayload {
  rideId: number;
}

export interface RideProposalRejectedPayload {
  rideId: number;
}

export interface RideProposalCancelledPayload {
  rideId: number;
  reason?: string;
}

export interface OpenRidesUpdatePayload {
  openRidesCount: number;
  openRides: OpenRide[];
}

export interface ChainRideOfferPayload {
  type?: string;
  rideId: number;
  rideData: {
    id: number;
    pickupAddress: string;
    dropoffAddress: string;
    price: number;
    distanceKm: number;
    riderName?: string;
    startLatLon?: { lat: number; lon: number } | null;
    endLatLon?: { lat: number; lon: number } | null;
    vehicleTypeId?: number;
    paymentMethod?: string;
    [key: string]: unknown;
  };
  currentRideId: number;
  remainingMinutes: number;
  pickupEtaMinutes: number;
  pickupDistanceKm: number;
  timestamp: number;
  timeoutMs?: number;
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
