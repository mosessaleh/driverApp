import { Stack } from 'expo-router';
import { AuthProvider } from '../src/context/AuthContext';
import { SettingsProvider } from '../src/context/SettingsContext';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { devLog } from '../src/config/security';
import '../src/i18n';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function Layout() {
  useEffect(() => {
    const setupAndroidChannel = async () => {
      if (Platform.OS !== 'android') return;

      await Notifications.setNotificationChannelAsync('driver-rides', {
        name: 'Ride Offers',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      await Notifications.setNotificationChannelAsync('user-updates', {
        name: 'General Updates',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    };

    // Request permissions for notifications
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        devLog('Notification permissions not granted');
      }
    };

    setupAndroidChannel().catch((error) => {
      console.warn('Failed to configure Android notification channel:', error);
    });
    requestPermissions();

    // Handle notification received while app is foreground
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      devLog('Notification received:', notification);
    });

    // Handle notification response (when user taps on notification)
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      devLog('Notification response received');
      const data = response.notification.request.content.data;

      // Navigate to dashboard if ride notification
      if (data && data.type === 'newRide') {
        router.push('/dashboard');
      }
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  return (
    <AuthProvider>
      <SettingsProvider>
        <Stack />
      </SettingsProvider>
    </AuthProvider>
  );
}
