import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SECURE_TOKEN_KEY = 'driverapp.auth.token';

const canUseSecureStore = Platform.OS !== 'web';

const getSecureStoreToken = async (): Promise<string | null> => {
  if (!canUseSecureStore) return null;

  try {
    return await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const getAuthToken = async (): Promise<string | null> => {
  const secureToken = await getSecureStoreToken();
  if (secureToken) return secureToken;

  // Web fallback (and migration fallback if needed)
  return AsyncStorage.getItem('token');
};

export const setAuthToken = async (token: string): Promise<void> => {
  if (canUseSecureStore) {
    await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    // Remove insecure legacy storage once secure storage is populated.
    await AsyncStorage.removeItem('token');
    return;
  }

  // Web fallback
  await AsyncStorage.setItem('token', token);
};

export const removeAuthToken = async (): Promise<void> => {
  if (canUseSecureStore) {
    try {
      await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
    } catch {
      // no-op
    }
  }

  await AsyncStorage.removeItem('token');
};

export const migrateLegacyAuthToken = async (): Promise<string | null> => {
  const secureToken = await getSecureStoreToken();
  if (secureToken) return secureToken;

  const legacyToken = await AsyncStorage.getItem('token');
  if (!legacyToken) return null;

  await setAuthToken(legacyToken);
  return legacyToken;
};

