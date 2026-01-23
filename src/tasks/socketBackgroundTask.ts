import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { connectSocket } from '../services/socket';

const SOCKET_BACKGROUND_TASK = 'socket-background-task';

if (Constants.appOwnership !== 'expo') {
  const TaskManager = require('expo-task-manager');
  TaskManager.defineTask(SOCKET_BACKGROUND_TASK, async () => {
    try {
      console.log('Running socket background task for driver');

      // Get token and vehicleTypeId from storage
      const token = await AsyncStorage.getItem('token');
      const vehicleTypeIdStr = await AsyncStorage.getItem('vehicleTypeId');
      const vehicleTypeId = vehicleTypeIdStr ? parseInt(vehicleTypeIdStr) : 1;

      if (token) {
        // Reconnect socket
        connectSocket(token, vehicleTypeId);
        console.log('Reconnected driver socket in background');
      }

      return 'success';
    } catch (error) {
      console.error('Driver socket background task failed:', error);
      return 'failure';
    }
  });
}

export { SOCKET_BACKGROUND_TASK };