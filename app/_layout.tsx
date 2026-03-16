import { Stack } from 'expo-router';
import { AuthProvider } from '../src/context/AuthContext';
import { SettingsProvider } from '../src/context/SettingsContext';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { devLog } from '../src/config/security';
import '../src/i18n';

type DriverNotificationPayload = {
  type?: string;
  screen?: string;
  route?: string;
  rideId?: number | string;
  bookingId?: number | string;
  id?: number | string;
};

type DriverKnownScreen = 'dashboard' | 'history' | 'upcoming' | 'profile' | 'settings' | 'schedule' | 'analytics' | 'ride-details';

const parseNotificationPayload = (value: unknown): DriverNotificationPayload => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return value as DriverNotificationPayload;
};

const normalizeScreenName = (value: unknown): DriverKnownScreen | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/^\/+/, '').toLowerCase();

  if (normalized === 'dashboard') return 'dashboard';
  if (normalized === 'history') return 'history';
  if (normalized === 'upcoming') return 'upcoming';
  if (normalized === 'profile') return 'profile';
  if (normalized === 'settings') return 'settings';
  if (normalized === 'schedule') return 'schedule';
  if (normalized === 'analytics') return 'analytics';
  if (normalized === 'ride-details' || normalized === 'ridedetails') return 'ride-details';

  return null;
};

const parseRideId = (payload: DriverNotificationPayload): string | null => {
  const candidate = payload.rideId ?? payload.bookingId ?? payload.id;
  const parsed = Number(candidate);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return String(parsed);
};

const navigateByScreen = (screen: DriverKnownScreen, payload: DriverNotificationPayload) => {
  if (screen === 'dashboard') {
    router.push('/dashboard');
    return;
  }

  if (screen === 'history') {
    router.push('/history');
    return;
  }

  if (screen === 'upcoming') {
    router.push('/upcoming');
    return;
  }

  if (screen === 'profile') {
    router.push('/profile');
    return;
  }

  if (screen === 'settings') {
    router.push('/settings');
    return;
  }

  if (screen === 'schedule') {
    router.push('/schedule');
    return;
  }

  if (screen === 'analytics') {
    router.push('/analytics');
    return;
  }

  if (screen === 'ride-details') {
    const rideId = parseRideId(payload);
    if (rideId) {
      router.push({ pathname: '/ride-details', params: { id: rideId } });
    } else {
      router.push('/dashboard');
    }
  }
};

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
      const payload = parseNotificationPayload(response.notification.request.content.data);

      const requestedScreen = normalizeScreenName(payload.screen ?? payload.route);
      if (requestedScreen) {
        navigateByScreen(requestedScreen, payload);
        return;
      }

      const notificationType = String(payload.type || '').trim().toLowerCase();

      if (
        notificationType === 'newride' ||
        notificationType === 'rideoffer' ||
        notificationType === 'rideaccepted' ||
        notificationType === 'ridecancelled' ||
        notificationType === 'ridestatusupdate' ||
        notificationType === 'chatmessage' ||
        notificationType === 'message'
      ) {
        navigateByScreen('dashboard', payload);
        return;
      }

      if (
        notificationType === 'scheduledlatewarning' ||
        notificationType === 'upcomingride' ||
        notificationType === 'scheduledoffer'
      ) {
        navigateByScreen('upcoming', payload);
        return;
      }

      navigateByScreen('dashboard', payload);
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
