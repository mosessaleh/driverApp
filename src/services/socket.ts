import io, { Socket } from 'socket.io-client';
import { jwtDecode } from 'jwt-decode';
import * as Location from 'expo-location';
import { getApiBaseUrl } from '../config/network';

const API_BASE_URL = getApiBaseUrl();

let socket: Socket | null = null;

let locationInterval: ReturnType<typeof setInterval> | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let isReconnecting = false;
let shouldReconnect = true;

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 10000;
let reconnectAttempts = 0;

let currentToken: string | null = null;
let currentVehicleTypeId = 1;
let currentJoinLocation: { lat: number; lng: number } | undefined;

export type ScheduledUpcomingOffersUpdatePayload = {
  pendingCount: number;
  pendingOffers: Array<{
    rideId: number;
    pickupTime?: string | null;
    createdAt?: number | string;
    timeoutMs?: number;
    expiresAt?: number | string;
    timeLeftMs?: number;
    rideData?: any;
  }>;
};

type SocketListener = (...args: any[]) => void;
const persistentListeners = new Map<string, Set<SocketListener>>();

const addPersistentListener = (event: string, callback: SocketListener) => {
  let listeners = persistentListeners.get(event);
  if (!listeners) {
    listeners = new Set<SocketListener>();
    persistentListeners.set(event, listeners);
  }

  if (!listeners.has(callback)) {
    listeners.add(callback);
    if (socket) {
      socket.on(event, callback as any);
    }
  }
};

const removePersistentListener = (event: string, callback?: SocketListener) => {
  const listeners = persistentListeners.get(event);

  if (!listeners) {
    if (socket) {
      socket.off(event);
    }
    return;
  }

  if (callback) {
    listeners.delete(callback);
    if (socket) {
      socket.off(event, callback as any);
    }
    if (listeners.size === 0) {
      persistentListeners.delete(event);
    }
    return;
  }

  if (socket) {
    listeners.forEach((cb) => socket?.off(event, cb as any));
    socket.off(event);
  }
  persistentListeners.delete(event);
};

const attachPersistentListeners = (targetSocket: Socket) => {
  persistentListeners.forEach((listeners, event) => {
    listeners.forEach((callback) => {
      targetSocket.on(event, callback as any);
    });
  });
};

const stopLocationUpdates = () => {
  if (locationInterval) {
    clearInterval(locationInterval);
    locationInterval = null;
  }
};

const startLocationUpdates = (driverId: number) => {
  stopLocationUpdates();

  locationInterval = setInterval(async () => {
    try {
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const locationData = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };

      if (socket && socket.connected) {
        socket.emit('updateLocation', { driverId, location: locationData });
        console.log('Location updated via socket:', locationData);
      }
    } catch (error) {
      console.error('Error updating location via socket:', error);
    }
  }, 30000);
};

const joinDriverRoom = () => {
  if (!socket || !currentToken) return;

  try {
    const decoded: any = jwtDecode(currentToken);
    const driverId = Number(decoded?.driverId ?? decoded?.id);

    if (!Number.isFinite(driverId) || driverId <= 0) {
      console.error('driverId not found in token payload');
      return;
    }

    socket.emit('join', {
      driverId,
      vehicleTypeId: currentVehicleTypeId,
      location: currentJoinLocation,
    });

    console.log('Joined driver room:', driverId, 'with vehicle type:', currentVehicleTypeId);
    startLocationUpdates(driverId);
  } catch (error) {
    console.error('Error decoding token for socket join:', error);
  }
};

const scheduleReconnect = () => {
  if (!shouldReconnect || !currentToken) return;
  if (isReconnecting) return;

  isReconnecting = true;
  reconnectAttempts += 1;

  const delay = Math.min(RECONNECT_BASE_DELAY * reconnectAttempts, RECONNECT_MAX_DELAY);

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  reconnectTimeout = setTimeout(() => {
    isReconnecting = false;

    if (!shouldReconnect || !currentToken) return;

    console.log(`Reconnecting socket (attempt ${reconnectAttempts})...`);

    if (!socket) {
      // سيتم إنشاء السوكيت من connectSocket لاحقاً
      connectSocket(currentToken, currentVehicleTypeId, currentJoinLocation);
      return;
    }

    socket.auth = { token: currentToken } as any;
    if (!socket.connected) {
      socket.connect();
    }
  }, delay);
};

const createSocket = () => {
  if (!currentToken) {
    throw new Error('Cannot create socket without token');
  }

  const newSocket = io(API_BASE_URL, {
    auth: { token: currentToken },
    transports: ['websocket'],
    reconnection: false,
  });

  attachPersistentListeners(newSocket);

  newSocket.on('connect', () => {
    console.log('Socket connected successfully');
    reconnectAttempts = 0;
    isReconnecting = false;

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    joinDriverRoom();
  });

  newSocket.on('connect_error', (err) => {
    console.error('Socket connect_error:', err?.message || err);
    scheduleReconnect();
  });

  newSocket.on('disconnect', (reason) => {
    console.log('Disconnected from socket:', reason);
    stopLocationUpdates();

    if (shouldReconnect && reason !== 'io client disconnect') {
      scheduleReconnect();
    }
  });

  socket = newSocket;
  return newSocket;
};

export const connectSocket = (
  token: string,
  vehicleTypeId: number = 1,
  location?: { lat: number; lng: number }
): Socket => {
  currentToken = token;
  currentVehicleTypeId = vehicleTypeId;
  currentJoinLocation = location;
  shouldReconnect = true;

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (!socket) {
    return createSocket();
  }

  socket.auth = { token } as any;

  if (socket.connected) {
    joinDriverRoom();
  } else {
    socket.connect();
  }

  return socket;
};

export const onDriverStatusUpdate = (
  callback: (data: { isOnline?: boolean; currentRideId: number | null; isBusy: boolean; rideAccepted: number | null }) => void
) => {
  addPersistentListener('driverStatusUpdate', callback as SocketListener);
};

export const offDriverStatusUpdate = () => {
  removePersistentListener('driverStatusUpdate');
};

export const disconnectSocket = () => {
  shouldReconnect = false;
  isReconnecting = false;
  reconnectAttempts = 0;
  currentToken = null;
  currentJoinLocation = undefined;

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  stopLocationUpdates();

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  persistentListeners.clear();
};

export const acceptRide = (rideId: number) => {
  if (socket) {
    socket.emit('acceptRide', { rideId });
  }
};

export const rejectRide = (rideId: number) => {
  if (socket) {
    socket.emit('rejectRide', { rideId });
  }
};

export const updateLocation = (location: { lat: number; lng: number }) => {
  if (socket) {
    socket.emit('updateLocation', { location });
  }
};

export const onRideAccepted = (callback: (data: { rideId: number }) => void) => {
  addPersistentListener('rideAccepted', callback as SocketListener);
};

export const onRideAcceptFailed = (callback: (data: { rideId: number; reason: string }) => void) => {
  addPersistentListener('rideAcceptFailed', callback as SocketListener);
};

export const onRideOffer = (
  callback: (data: { type?: string; offerType?: string; scheduled?: boolean; rideId: number; rideData: any; timestamp: number; timeoutMs?: number }) => void
) => {
  addPersistentListener('rideOffer', callback as SocketListener);
};

export const offRideOffer = (
  callback?: (data: { type?: string; offerType?: string; scheduled?: boolean; rideId: number; rideData: any; timestamp: number; timeoutMs?: number }) => void
) => {
  removePersistentListener('rideOffer', callback as SocketListener | undefined);
};

export const onRideOfferTimeout = (callback: (data: { rideId: number }) => void) => {
  addPersistentListener('rideOfferTimeout', callback as SocketListener);
};

export const offRideOfferTimeout = () => {
  removePersistentListener('rideOfferTimeout');
};

export const onRideOfferRejected = (callback: (data: { rideId: number }) => void) => {
  addPersistentListener('rideOfferRejected', callback as SocketListener);
};

export const offRideOfferRejected = () => {
  removePersistentListener('rideOfferRejected');
};

export const onScheduledOfferResult = (
  callback: (data: { rideId: number; selected: boolean; message?: string; pickupTime?: string; rideData?: any }) => void
) => {
  addPersistentListener('scheduledOfferResult', callback as SocketListener);
};

export const offScheduledOfferResult = () => {
  removePersistentListener('scheduledOfferResult');
};

export const onScheduledOfferAcknowledged = (callback: (data: { rideId: number }) => void) => {
  addPersistentListener('scheduledOfferAcknowledged', callback as SocketListener);
};

export const offScheduledOfferAcknowledged = () => {
  removePersistentListener('scheduledOfferAcknowledged');
};

export const onScheduledUpcomingOffersUpdate = (
  callback: (data: ScheduledUpcomingOffersUpdatePayload) => void
) => {
  addPersistentListener('scheduledUpcomingOffersUpdate', callback as SocketListener);
};

export const offScheduledUpcomingOffersUpdate = () => {
  removePersistentListener('scheduledUpcomingOffersUpdate');
};

export const onRideCancelled = (callback: (data: { rideId: number }) => void) => {
  addPersistentListener('rideCancelled', callback as SocketListener);
};

export const offRideCancelled = () => {
  removePersistentListener('rideCancelled');
};

export const sendRideTimeout = (rideId: number) => {
  if (socket) {
    socket.emit('rideTimeout', { rideId });
  }
};

// Chat functionality
export const joinChat = (bookingId: number) => {
  if (socket) {
    socket.emit('joinChat', { bookingId });
  }
};

export const sendMessage = (bookingId: number, message: string, sender: string) => {
  if (socket) {
    socket.emit('sendMessage', {
      bookingId,
      message,
      sender,
    });
  }
};

export const onNewMessage = (callback: (data: { message: string; sender: string; timestamp: string }) => void) => {
  addPersistentListener('newMessage', callback as SocketListener);
};

export const offNewMessage = () => {
  removePersistentListener('newMessage');
};

export const onPickupProximity = (
  callback: (data: { rideId: number; distanceMeters: number; countdownStart: number; countdownDuration: number }) => void
) => {
  addPersistentListener('pickupProximity', callback as SocketListener);
};

export const offPickupProximity = () => {
  removePersistentListener('pickupProximity');
};

export const onPickupCountdownExpired = (callback: (data: { rideId: number }) => void) => {
  addPersistentListener('pickupCountdownExpired', callback as SocketListener);
};

export const offPickupCountdownExpired = () => {
  removePersistentListener('pickupCountdownExpired');
};

export const onScheduledLateWarning = (
  callback: (data: { rideId: number; lateMinutes: number; remainingMinutes: number; etaMinutes?: number; minutesBeforePickup?: number; pickupTime?: string }) => void
) => {
  addPersistentListener('scheduledLateWarning', callback as SocketListener);
};

export const offScheduledLateWarning = () => {
  removePersistentListener('scheduledLateWarning');
};

export const getSocket = (): Socket | null => socket;
