import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthState, User } from '../types';
import { loginDriver, getDriverStatus, logoutDriver } from '../services/api';
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
            await getDriverStatus(token);
            setAuthState({ user, token, isLoading: false });
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

  const login = async (username: string, password: string, startKM: number) => {
    try {
      const response = await loginDriver(username, password, startKM);
      if (response.token && response.driver && response.shiftId) {
        const userData = {
          id: response.driver.id,
          name: response.driver.name,
          car: response.driver.car,
          shiftId: response.shiftId
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