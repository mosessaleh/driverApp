import Constants from 'expo-constants';

export const isDevelopmentBuild = (): boolean => {
  return typeof __DEV__ !== 'undefined' && __DEV__;
};

export const devLog = (...args: any[]) => {
  if (isDevelopmentBuild()) {
    console.log(...args);
  }
};

export const devWarn = (...args: any[]) => {
  if (isDevelopmentBuild()) {
    console.warn(...args);
  }
};

const runtimeGoogleMapsApiKey =
  Constants.expoConfig?.extra?.googleMapsApiKey?.trim() ||
  Constants.manifest?.extra?.googleMapsApiKey?.trim();

export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
  process.env.GOOGLE_MAPS_API_KEY?.trim() ||
  runtimeGoogleMapsApiKey ||
  '';

// Debug: log resolved key in development to verify runtime loading
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  // eslint-disable-next-line no-console
  console.log('Resolved GOOGLE_MAPS_API_KEY:', GOOGLE_MAPS_API_KEY ? '[REDACTED]' : '(empty)');
}

export function getGoogleMapsApiKey(): string {
  return GOOGLE_MAPS_API_KEY;
}

export function requireGoogleMapsApiKey(context: string): string {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error(
      `Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY. Required in ${context}. ` +
        'Define it in .env for local development and in EAS environment variables for cloud builds.'
    );
  }

  return GOOGLE_MAPS_API_KEY;
}

