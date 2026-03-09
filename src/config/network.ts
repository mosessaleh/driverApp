import { isDevelopmentBuild } from './security';

const LOCAL_NETWORK_HOST_REGEX = /^(localhost|127\.0\.0\.1|::1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

const assertAllowedProtocol = (url: URL) => {
  if (url.protocol !== 'http:') return;

  const isLocalNetworkHost = LOCAL_NETWORK_HOST_REGEX.test(url.hostname);
  if (isDevelopmentBuild() && isLocalNetworkHost) return;

  throw new Error(
    'Insecure API URL detected. Use HTTPS in production. HTTP is only allowed for local development hosts.'
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

