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

export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || '';

export function requireGoogleMapsApiKey(context: string): string {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error(
      `Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY. Required in ${context}. ` +
        'Define it in .env for local development and in EAS environment variables for cloud builds.'
    );
  }

  return GOOGLE_MAPS_API_KEY;
}

