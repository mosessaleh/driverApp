import * as Sentry from '@sentry/react-native';
import { isDevelopmentBuild } from '../config/security';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

export function initSentry() {
  if (isDevelopmentBuild()) {
    return;
  }

  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured. Set EXPO_PUBLIC_SENTRY_DSN in .env');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    tracesSampleRate: 0.2,
    attachScreenshot: false,
    enableNative: false,
  });
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (isDevelopmentBuild()) return;

  Sentry.captureException(error, {
    extra: context,
  });
}

export function setSentryUser(user: { id: string; name: string; email?: string }) {
  Sentry.setUser({
    id: user.id,
    username: user.name,
    email: user.email,
  });
}

export function clearSentryUser() {
  Sentry.setUser(null);
}

export { Sentry };
