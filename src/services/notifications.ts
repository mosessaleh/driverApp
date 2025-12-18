import * as Notifications from 'expo-notifications';

export const sendLocalNotification = async (title: string, body: string) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    console.warn('Failed to send notification:', error);
  }
};