import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { connectSocket, getSocket } from '../services/socket';
import * as Location from 'expo-location';

const SOCKET_BACKGROUND_TASK = 'socket-background-task';
const LOCATION_BACKGROUND_TASK = 'location-background-task';

if (Constants.appOwnership !== 'expo') {
  const TaskManager = require('expo-task-manager');

  // Socket reconnection task
  TaskManager.defineTask(SOCKET_BACKGROUND_TASK, async () => {
    try {
      console.log('Running socket background task for driver');

      // Get token and vehicleTypeId from storage
      const token = await AsyncStorage.getItem('token');
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
  TaskManager.defineTask(LOCATION_BACKGROUND_TASK, async ({ data, error }: any) => {
    if (error) {
      console.error('Location background task error:', error);
      return;
    }

    if (data) {
      const { locations } = data;
      console.log('Received location update in background:', locations);

      // Here you can send location to server or handle it
      // For now, just log it
    }
  });
}

export { SOCKET_BACKGROUND_TASK, LOCATION_BACKGROUND_TASK };