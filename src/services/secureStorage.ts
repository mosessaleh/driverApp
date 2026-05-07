import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SECURE_TOKEN_KEY = 'driverapp.auth.token';
const SECURE_USER_KEY = 'driverapp.auth.user';
const SECURE_RESTRICTED_OFFERS_KEY = 'driverapp.auth.restrictedOffers';
const SECURE_RESTRICTED_OFFERS_UNTIL_KEY = 'driverapp.auth.restrictedOffersUntil';
const SECURE_PUSH_TOKEN_KEY = 'driverapp.push.token';

const canUseSecureStore = Platform.OS !== 'web';

const getSecureValue = async (key: string): Promise<string | null> => {
  if (!canUseSecureStore) return null;

  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

const setSecureValue = async (key: string, value: string): Promise<void> => {
  if (!canUseSecureStore) {
    return;
  }

  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
};

const removeSecureValue = async (key: string): Promise<void> => {
  if (!canUseSecureStore) return;

  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // no-op
  }
};

const getStoredValue = async (secureKey: string, legacyKey: string): Promise<string | null> => {
  const secureValue = await getSecureValue(secureKey);
  if (secureValue) return secureValue;

  return AsyncStorage.getItem(legacyKey);
};

const setStoredValue = async (secureKey: string, legacyKey: string, value: string): Promise<void> => {
  if (canUseSecureStore) {
    await setSecureValue(secureKey, value);
    await AsyncStorage.removeItem(legacyKey);
    return;
  }

  await AsyncStorage.setItem(legacyKey, value);
};

const removeStoredValue = async (secureKey: string, legacyKey: string): Promise<void> => {
  await removeSecureValue(secureKey);
  await AsyncStorage.removeItem(legacyKey);
};

const migrateLegacyStoredValue = async (secureKey: string, legacyKey: string): Promise<string | null> => {
  const secureValue = await getSecureValue(secureKey);
  if (secureValue) return secureValue;

  const legacyValue = await AsyncStorage.getItem(legacyKey);
  if (!legacyValue) return null;

  await setStoredValue(secureKey, legacyKey, legacyValue);
  return legacyValue;
};

const getSecureStoreToken = async (): Promise<string | null> => {
  return getSecureValue(SECURE_TOKEN_KEY);
};

export const getAuthToken = async (): Promise<string | null> => {
  const secureToken = await getSecureStoreToken();
  if (secureToken) return secureToken;

  // Web fallback (and migration fallback if needed)
  return AsyncStorage.getItem('token');
};

export const setAuthToken = async (token: string): Promise<void> => {
  await setStoredValue(SECURE_TOKEN_KEY, 'token', token);
};

export const removeAuthToken = async (): Promise<void> => {
  await removeStoredValue(SECURE_TOKEN_KEY, 'token');
};

export const migrateLegacyAuthToken = async (): Promise<string | null> => {
  return migrateLegacyStoredValue(SECURE_TOKEN_KEY, 'token');
};

const getSecureStoreUser = async (): Promise<string | null> => {
  return getSecureValue(SECURE_USER_KEY);
};

export const getStoredAuthUser = async (): Promise<string | null> => {
  const secureUser = await getSecureStoreUser();
  if (secureUser) return secureUser;

  return AsyncStorage.getItem('user');
};

export const setStoredAuthUser = async (user: string): Promise<void> => {
  await setStoredValue(SECURE_USER_KEY, 'user', user);
};

export const removeStoredAuthUser = async (): Promise<void> => {
  await removeStoredValue(SECURE_USER_KEY, 'user');
};

export const migrateLegacyAuthUser = async (): Promise<string | null> => {
  return migrateLegacyStoredValue(SECURE_USER_KEY, 'user');
};

export const getStoredRestrictedOffers = async (): Promise<string | null> => {
  return getStoredValue(SECURE_RESTRICTED_OFFERS_KEY, 'restrictedOffers');
};

export const setStoredRestrictedOffers = async (value: string): Promise<void> => {
  await setStoredValue(SECURE_RESTRICTED_OFFERS_KEY, 'restrictedOffers', value);
};

export const removeStoredRestrictedOffers = async (): Promise<void> => {
  await removeStoredValue(SECURE_RESTRICTED_OFFERS_KEY, 'restrictedOffers');
};

export const migrateLegacyRestrictedOffers = async (): Promise<string | null> => {
  return migrateLegacyStoredValue(SECURE_RESTRICTED_OFFERS_KEY, 'restrictedOffers');
};

export const getStoredRestrictedOffersUntil = async (): Promise<string | null> => {
  return getStoredValue(SECURE_RESTRICTED_OFFERS_UNTIL_KEY, 'restrictedOffersUntil');
};

export const setStoredRestrictedOffersUntil = async (value: string): Promise<void> => {
  await setStoredValue(SECURE_RESTRICTED_OFFERS_UNTIL_KEY, 'restrictedOffersUntil', value);
};

export const removeStoredRestrictedOffersUntil = async (): Promise<void> => {
  await removeStoredValue(SECURE_RESTRICTED_OFFERS_UNTIL_KEY, 'restrictedOffersUntil');
};

export const migrateLegacyRestrictedOffersUntil = async (): Promise<string | null> => {
  return migrateLegacyStoredValue(SECURE_RESTRICTED_OFFERS_UNTIL_KEY, 'restrictedOffersUntil');
};

export const getStoredPushToken = async (): Promise<string | null> => {
  return getStoredValue(SECURE_PUSH_TOKEN_KEY, 'expoPushToken');
};

export const setStoredPushToken = async (value: string): Promise<void> => {
  await setStoredValue(SECURE_PUSH_TOKEN_KEY, 'expoPushToken', value);
};

export const removeStoredPushToken = async (): Promise<void> => {
  await removeStoredValue(SECURE_PUSH_TOKEN_KEY, 'expoPushToken');
};

export const migrateLegacyPushToken = async (): Promise<string | null> => {
  return migrateLegacyStoredValue(SECURE_PUSH_TOKEN_KEY, 'expoPushToken');
};

