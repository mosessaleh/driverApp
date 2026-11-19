/**
 * TODO: Production - Implement SSL Certificate Pinning
 * Options: react-native-ssl-pinning, TrustKit (iOS), or Network Security Config (Android)
 * See: https://docs.expo.dev/versions/latest/sdk/expo-build-properties/#androidnetworksecurityconfig
 */

import { isDevelopmentBuild } from './security';

const assertAllowedProtocol = (url: URL) => {
  if (url.protocol !== 'http:') return;

  // Development builds (Expo Go, dev clients) may talk to any HTTP host,
  // including remote dev servers. Production builds require HTTPS.
  if (isDevelopmentBuild()) return;

  throw new Error(
    'Insecure API URL detected. Use HTTPS in production. HTTP is only allowed for local development hosts.',
  );
};

export const getApiBaseUrl = (): string => {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (!configuredUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is required and must point to the backend API.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL is not a valid URL.');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('EXPO_PUBLIC_API_URL must start with http:// or https://');
  }

  assertAllowedProtocol(parsedUrl);

  return configuredUrl.replace(/\/$/, '');
};
