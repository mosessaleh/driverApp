import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AuthState, User } from '../types';
import {
  loginDriver,
  getDriverStatus,
  logoutDriver,
  updatePushToken,
  DriverLoginResponse,
  isDriverLoginSuccessResponse,
} from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { migrateLegacyAuthToken, removeAuthToken, setAuthToken } from '../services/secureStorage';
import { LOCATION_BACKGROUND_TASK, SOCKET_BACKGROUND_TASK } from '../tasks/socketBackgroundTask';

type LoginOptions = {
  confirmOutsideSchedule?: boolean;
};

const AuthContext = createContext<{
  authState: AuthState;
  login: (username: string, password: string, startKM: number, options?: LoginOptions) => Promise<DriverLoginResponse>;
  logout: () => Promise<void>;
} | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({ user: null, token: null, isLoading: true, restrictedOffers: false, restrictedOffersUntil: null });

  const registerBackgroundTasks = async () => {
    if (Constants.appOwnership === 'expo') {
      return;
    }

    try {
      const isSocketTaskRegistered = await BackgroundFetch.getStatusAsync();
      if (isSocketTaskRegistered !== BackgroundFetch.BackgroundFetchStatus.Restricted) {
        const hasSocketTask = await TaskManager.isTaskRegisteredAsync(SOCKET_BACKGROUND_TASK);

        if (!hasSocketTask) {
          await BackgroundFetch.registerTaskAsync(SOCKET_BACKGROUND_TASK, {
            minimumInterval: 15 * 60,
            stopOnTerminate: false,
            startOnBoot: true,
          });
        }
      }
    } catch (error) {
      console.warn('Failed to register socket background task:', error);
    }

    try {
      const hasLocationTask = await Location.hasStartedLocationUpdatesAsync(LOCATION_BACKGROUND_TASK);
      if (!hasLocationTask) {
        await Location.startLocationUpdatesAsync(LOCATION_BACKGROUND_TASK, {
          accuracy: Location.Accuracy.High,
          timeInterval: 30000,
          distanceInterval: 50,
          showsBackgroundLocationIndicator: true,
        });
      }
    } catch (error) {
      console.warn('Failed to register background location task from AuthContext:', error);
    }
  };

  const unregisterBackgroundTasks = async () => {
    if (Constants.appOwnership === 'expo') {
      return;
    }

    try {
      const hasSocketTask = await TaskManager.isTaskRegisteredAsync(SOCKET_BACKGROUND_TASK);
      if (hasSocketTask) {
        await BackgroundFetch.unregisterTaskAsync(SOCKET_BACKGROUND_TASK);
      }
    } catch (error) {
      console.warn('Failed to unregister socket background task:', error);
    }

    try {
      const hasLocationTask = await Location.hasStartedLocationUpdatesAsync(LOCATION_BACKGROUND_TASK);
      if (hasLocationTask) {
        await Location.stopLocationUpdatesAsync(LOCATION_BACKGROUND_TASK);
      }
    } catch (error) {
      console.warn('Failed to unregister background location task:', error);
    }
  };

  useEffect(() => {
    const loadAuthState = async () => {
      try {
        const token = await migrateLegacyAuthToken();
        const userStr = await AsyncStorage.getItem('user');
        const restrictedOffersStr = await AsyncStorage.getItem('restrictedOffers');
        const restrictedOffersUntil = await AsyncStorage.getItem('restrictedOffersUntil');
        const restrictedOffers = restrictedOffersStr === 'true';
        if (token && userStr) {
          const user = JSON.parse(userStr);
          // Validate token by checking driver status
          try {
            const status = await getDriverStatus(token);
            if (status.hasActiveShift) {
              setAuthState({
                user,
                token,
                isLoading: false,
                restrictedOffers: Boolean(status?.restrictedOffers ?? restrictedOffers),
                restrictedOffersUntil: status?.restrictedOffersUntil ?? restrictedOffersUntil ?? null
              });
            } else {
              // No active shift, clear stored data
              await removeAuthToken();
              await AsyncStorage.removeItem('user');
              await AsyncStorage.removeItem('restrictedOffers');
              await AsyncStorage.removeItem('restrictedOffersUntil');
              setAuthState({ user: null, token: null, isLoading: false, restrictedOffers: false, restrictedOffersUntil: null });
            }
          } catch (error) {
            console.error('Token validation failed:', error);
            // Clear invalid stored data
            await removeAuthToken();
            await AsyncStorage.removeItem('user');
            await AsyncStorage.removeItem('restrictedOffers');
            await AsyncStorage.removeItem('restrictedOffersUntil');
            setAuthState({ user: null, token: null, isLoading: false, restrictedOffers: false, restrictedOffersUntil: null });
          }
        } else {
          setAuthState({ user: null, token: null, isLoading: false, restrictedOffers: false, restrictedOffersUntil: null });
        }
      } catch (error) {
        console.error('Error loading auth state:', error);
        setAuthState({ user: null, token: null, isLoading: false, restrictedOffers: false, restrictedOffersUntil: null });
      }
    };
    loadAuthState();
  }, []);

  useEffect(() => {
    if (authState.token) {
      connectSocket(authState.token, authState.user?.vehicleTypeId || 1);
    } else {
      disconnectSocket();
    }
    return () => {
      disconnectSocket();
    };
  }, [authState.token]);

  useEffect(() => {
    const syncBackgroundTasks = async () => {
      if (authState.token) {
        await registerBackgroundTasks();
      } else {
        await unregisterBackgroundTasks();
      }
    };

    syncBackgroundTasks();
  }, [authState.token]);

  // Register for push notifications
  useEffect(() => {
    const registerForPushNotifications = async () => {
      if (!authState.token) return;

      console.log('App ownership:', Constants.appOwnership);
      console.log('Expo Go check:', Constants.appOwnership === 'expo' ? 'Running in Expo Go' : 'Not Expo Go');

      // Skip push notifications in Expo Go as they are not supported in SDK 54+
      if (Constants.appOwnership === 'expo') {
        console.log('Skipping push notifications in Expo Go');
        return;
      }

      try {
        // Dynamically import expo-notifications only when not in Expo Go
        const { getExpoPushTokenAsync, getPermissionsAsync } = await import('expo-notifications');

        // Permissions are requested in app layout; only check status here
        const { status: permissionStatus } = await getPermissionsAsync();

        if (permissionStatus !== 'granted') {
          console.warn('Notification permissions not granted');
          return;
        }

        const tokenData = await getExpoPushTokenAsync();
        const pushToken = tokenData.data;

        const storedPushToken = await AsyncStorage.getItem('expoPushToken');
        if (storedPushToken === pushToken) {
          return;
        }

        // Send push token to server
        await updatePushToken(pushToken, authState.token);
        await AsyncStorage.setItem('expoPushToken', pushToken);
        console.log('Push token registered successfully');
      } catch (error) {
        // Push notifications may not be available
        console.warn('Push notifications not available:', error instanceof Error ? error.message : String(error));
        // Don't fail the login process due to push notification issues
      }
    };

    registerForPushNotifications();

    const tokenSubscription = Notifications.addPushTokenListener(async (token) => {
      if (!authState.token) return;
      const nextToken = token?.data;
      if (!nextToken) return;

      try {
        const currentStored = await AsyncStorage.getItem('expoPushToken');
        if (currentStored === nextToken) return;
        await updatePushToken(nextToken, authState.token);
        await AsyncStorage.setItem('expoPushToken', nextToken);
      } catch (error) {
        console.warn('Failed to update rotated push token:', error);
      }
    });

    return () => {
      tokenSubscription.remove();
    };
  }, [authState.token]);

  const login = async (
    username: string,
    password: string,
    startKM: number,
    options?: LoginOptions
  ): Promise<DriverLoginResponse> => {
    try {
      const response = await loginDriver(
        username,
        password,
        startKM,
        Boolean(options?.confirmOutsideSchedule)
      );

      if (response.requiresConfirmation === true) {
        return response;
      }

      if (isDriverLoginSuccessResponse(response)) {
        const restrictedOffers = Boolean(response.restrictedOffers);
        const restrictedOffersUntil = response.restrictedOffersUntil || null;
        const userData = {
          id: String(response.driver.id),
          name: response.driver.name,
          car: response.driver.car,
          vehicleTypeId: response.driver?.vehicleTypeId || 1,
          shiftId: response.shiftId,
          shiftStartTime: response.shiftStartTime || undefined,
          rating: response.driver.rating || 5.0,
          schedule: response.schedule || null
        };
        await setAuthToken(response.token);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        await AsyncStorage.setItem('vehicleTypeId', String(userData.vehicleTypeId || 1));
        await AsyncStorage.setItem('restrictedOffers', restrictedOffers ? 'true' : 'false');
        if (restrictedOffersUntil) {
          await AsyncStorage.setItem('restrictedOffersUntil', String(restrictedOffersUntil));
        } else {
          await AsyncStorage.removeItem('restrictedOffersUntil');
        }
        setAuthState({
          user: userData,
          token: response.token,
          isLoading: false,
          restrictedOffers,
          restrictedOffersUntil
        });
        return response;
      } else {
        throw new Error('Invalid login response');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (authState.token) {
        await logoutDriver(authState.token);
      }
    } catch (error) {
      console.error('Server logout failed:', error);
    }
    await removeAuthToken();
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('vehicleTypeId');
    await AsyncStorage.removeItem('expoPushToken');
    await AsyncStorage.removeItem('restrictedOffers');
    await AsyncStorage.removeItem('restrictedOffersUntil');
    await unregisterBackgroundTasks();
    setAuthState({ user: null, token: null, isLoading: false, restrictedOffers: false, restrictedOffersUntil: null });
  };

  return (
    <AuthContext.Provider value={{ authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
