import * as Location from 'expo-location';

export const requestLocationPermission = async (): Promise<boolean> => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
};

export const getCurrentLocation = async (): Promise<Location.LocationObject | null> => {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return location;
  } catch (error) {
    console.error('Error getting location:', error);
    return null;
  }
};

export const watchLocation = (
  callback: (location: Location.LocationObject) => void,
  errorCallback?: (error: any) => void
): (() => void) => {
  let subscription: Location.LocationSubscription | null = null;

  const startWatching = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      errorCallback?.('Location permission denied');
      return;
    }

    subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 30000, // Update every 30 seconds
        distanceInterval: 10, // Or when moved 10 meters
      },
      callback
    );
  };

  startWatching();

  return () => {
    if (subscription) {
      subscription.remove();
    }
  };
};