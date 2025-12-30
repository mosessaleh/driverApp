import io, { Socket } from 'socket.io-client';
import { jwtDecode } from 'jwt-decode';
import * as Location from 'expo-location';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

let socket: Socket | null = null;

let locationInterval: NodeJS.Timeout | null = null;

export const connectSocket = (token: string, vehicleTypeId: number = 1, location?: { lat: number; lng: number }): Socket => {
  if (socket) {
    socket.disconnect();
  }
  socket = io(API_BASE_URL, {
    auth: { token },
    transports: ['websocket'],
  });
  socket.on('connect', () => {
    console.log('Socket connected successfully');
    // Decode token to get driverId
    try {
      const decoded: any = jwtDecode(token);
      const driverId = decoded.driverId;
      socket?.emit('join', { driverId, vehicleTypeId, location });
      console.log('Joined driver room:', driverId, 'with vehicle type:', vehicleTypeId);

      // Start sending location updates every 30 seconds
      startLocationUpdates(driverId);
    } catch (error) {
      console.error('Error decoding token for socket join:', error);
    }
  });
  socket.on('disconnect', () => {
    console.log('Disconnected from socket');
    stopLocationUpdates();
  });
  return socket;
};

const startLocationUpdates = (driverId: number) => {
  stopLocationUpdates(); // Clear any existing interval
  locationInterval = setInterval(async () => {
    try {
      // Get current location
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const locationData = {
        lat: location.coords.latitude,
        lng: location.coords.longitude
      };

      // Send via socket
      if (socket && socket.connected) {
        socket.emit('updateLocation', { driverId, location: locationData });
        console.log('Location updated via socket:', locationData);
      }
    } catch (error) {
      console.error('Error updating location via socket:', error);
    }
  }, 30000); // 30 seconds
};

const stopLocationUpdates = () => {
  if (locationInterval) {
    clearInterval(locationInterval);
    locationInterval = null;
  }
};

export const onDriverStatusUpdate = (callback: (data: { currentRideId: number | null; isBusy: boolean; rideAccepted: number | null }) => void) => {
  if (socket) {
    socket.on('driverStatusUpdate', callback);
  }
};

export const offDriverStatusUpdate = () => {
  if (socket) {
    socket.off('driverStatusUpdate');
  }
};

export const disconnectSocket = () => {
  stopLocationUpdates();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const onNewRide = (callback: (data: { ride: any }) => void) => {
  if (socket) {
    socket.on('newRide', callback);
  }
};

export const offNewRide = () => {
  if (socket) {
    socket.off('newRide');
  }
};

export const acceptRide = (rideId: number, driverId: number) => {
  if (socket) {
    socket.emit('acceptRide', { rideId, driverId });
  }
};

export const rejectRide = (rideId: number, driverId: number) => {
  if (socket) {
    socket.emit('rejectRide', { rideId, driverId });
  }
};

export const updateLocation = (driverId: number, location: { lat: number; lng: number }) => {
  if (socket) {
    socket.emit('updateLocation', { driverId, location });
  }
};

export const onRideAccepted = (callback: (data: { rideId: number }) => void) => {
  if (socket) {
    socket.on('rideAccepted', callback);
  }
};

export const onRideAcceptFailed = (callback: (data: { rideId: number; reason: string }) => void) => {
  if (socket) {
    socket.on('rideAcceptFailed', callback);
  }
};

export const onRideOffer = (callback: (data: { action: string; rideId: number; timestamp: number }) => void) => {
  if (socket) {
    socket.on('rideOffer', callback);
  }
};

export const offRideOffer = () => {
  if (socket) {
    socket.off('rideOffer');
  }
};

export const getSocket = (): Socket | null => socket;