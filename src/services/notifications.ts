import * as Notifications from 'expo-notifications';

export const sendLocalNotification = async (title: string, body: string) => {
  console.log('Sending local notification:', title, body);
  try {
    const result = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
      },
      trigger: null, // Show immediately
    });
    console.log('Notification scheduled:', result);
  } catch (error) {
    console.warn('Failed to send notification:', error);
  }
};

export const getPushToken = async () => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission not granted');
    }
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch (error) {
    console.warn('Failed to get push token:', error);
    return null;
  }
};