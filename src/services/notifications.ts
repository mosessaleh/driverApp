import * as Notifications from 'expo-notifications';
import { devLog } from '../config/security';

export const sendLocalNotification = async (title: string, body: string) => {
  devLog('Sending local notification');
  try {
    const result = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
      },
      trigger: null, // Show immediately
    });
    devLog('Notification scheduled:', result);
  } catch (error) {
    console.warn('Failed to send notification:', error);
  }
};
