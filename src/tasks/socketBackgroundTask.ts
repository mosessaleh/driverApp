import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { connectSocket, getSocket } from '../services/socket';
import * as Location from 'expo-location';
import { getAuthToken } from '../services/secureStorage';
import { updateDriverLocation } from '../services/api';

const SOCKET_BACKGROUND_TASK = 'socket-background-task';
const LOCATION_BACKGROUND_TASK = 'location-background-task';

type BackgroundLocationPoint = {
  coords?: {
    latitude?: number;
    longitude?: number;
  };
  timestamp?: number;
};

type BackgroundLocationTaskPayload = {
  locations?: BackgroundLocationPoint[];
};

if (Constants.appOwnership !== 'expo') {
  const TaskManager = require('expo-task-manager');

  // Socket reconnection task
  TaskManager.defineTask(SOCKET_BACKGROUND_TASK, async () => {
    try {
      console.log('Running socket background task for driver');

      // Get token and vehicleTypeId from storage
      const token = await getAuthToken();
      const vehicleTypeIdStr = await AsyncStorage.getItem('vehicleTypeId');
      const vehicleTypeId = vehicleTypeIdStr ? parseInt(vehicleTypeIdStr) : 1;

      if (token) {
        const socket = getSocket();
        if (!socket || !socket.connected) {
          console.log('Socket not connected, attempting to reconnect');
          connectSocket(token, vehicleTypeId);
          console.log('Reconnected driver socket in background');
        } else {
          console.log('Socket already connected in background');
        }
      } else {
        console.log('No token found for background socket reconnection');
      }

      return 'success';
    } catch (error) {
      console.error('Driver socket background task failed:', error);
      return 'failure';
    }
  });

  // Location tracking task
  TaskManager.defineTask(
    LOCATION_BACKGROUND_TASK,
    async ({ data, error }: { data?: BackgroundLocationTaskPayload; error?: Error }) => {
    if (error) {
      console.error('Location background task error:', error);
      return;
    }

      const locations = data?.locations;
      if (!Array.isArray(locations) || locations.length === 0) {
        return;
      }

      const latestLocation = locations[locations.length - 1];
      const latitude = Number(latestLocation?.coords?.latitude);
      const longitude = Number(latestLocation?.coords?.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      try {
        const token = await getAuthToken();
        if (!token) {
          return;
        }

        const timestamp =
          typeof latestLocation?.timestamp === 'number' && Number.isFinite(latestLocation.timestamp)
            ? new Date(latestLocation.timestamp).toISOString()
            : new Date().toISOString();

        await updateDriverLocation(latitude, longitude, token, timestamp);

        await AsyncStorage.setItem(
          'driverapp.lastBackgroundLocation',
          JSON.stringify({ latitude, longitude, timestamp })
        );
      } catch (locationUpdateError) {
        console.error('Failed to sync background location for driver:', locationUpdateError);
      }
    }
  );
}

export { SOCKET_BACKGROUND_TASK, LOCATION_BACKGROUND_TASK };
