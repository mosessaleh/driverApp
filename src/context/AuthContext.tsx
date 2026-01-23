import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AuthState, User } from '../types';
import { loginDriver, getDriverStatus, logoutDriver, updatePushToken } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext<{
  authState: AuthState;
  login: (username: string, password: string, startKM: number) => Promise<void>;
  logout: () => Promise<void>;
} | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({ user: null, token: null, isLoading: true });

  useEffect(() => {
    const loadAuthState = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const userStr = await AsyncStorage.getItem('user');
        if (token && userStr) {
          const user = JSON.parse(userStr);
          // Validate token by checking driver status
          try {
            const status = await getDriverStatus(token);
            if (status.hasActiveShift) {
              setAuthState({ user, token, isLoading: false });
            } else {
              // No active shift, clear stored data
              await AsyncStorage.removeItem('token');
              await AsyncStorage.removeItem('user');
              setAuthState({ user: null, token: null, isLoading: false });
            }
          } catch (error) {
            console.error('Token validation failed:', error);
            // Clear invalid stored data
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
            setAuthState({ user: null, token: null, isLoading: false });
          }
        } else {
          setAuthState({ user: null, token: null, isLoading: false });
        }
      } catch (error) {
        console.error('Error loading auth state:', error);
        setAuthState({ user: null, token: null, isLoading: false });
      }
    };
    loadAuthState();
  }, []);

  useEffect(() => {
    if (authState.token) {
      connectSocket(authState.token);
    } else {
      disconnectSocket();
    }
    return () => {
      disconnectSocket();
    };
  }, [authState.token]);

  // Background fetch is disabled for now to avoid native module issues in development
  // TODO: Re-enable when using development build
  // useEffect(() => {
  //   ...
  // }, [authState.token]);

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
        const { getExpoPushTokenAsync } = await import('expo-notifications');
        const tokenData = await getExpoPushTokenAsync();
        const pushToken = tokenData.data;

        // Send push token to server
        await updatePushToken(pushToken, authState.token);
        console.log('Push token registered:', pushToken);
      } catch (error) {
        // Push notifications may not be available
        console.warn('Push notifications not available:', error instanceof Error ? error.message : String(error));
        console.log('Error type:', typeof error, 'Error value:', error);
        // Don't fail the login process due to push notification issues
      }
    };

    registerForPushNotifications();
  }, [authState.token]);

  const login = async (username: string, password: string, startKM: number) => {
    try {
      const response = await loginDriver(username, password, startKM);
      if (response.token && response.driver && response.shiftId) {
        const userData = {
          id: response.driver.id,
          name: response.driver.name,
          car: response.driver.car,
          shiftId: response.shiftId,
          shiftStartTime: response.shiftStartTime
        };
        await AsyncStorage.setItem('token', response.token);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        setAuthState({ user: userData, token: response.token, isLoading: false });
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
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setAuthState({ user: null, token: null, isLoading: false });
  };

  return (
    <AuthContext.Provider value={{ authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};