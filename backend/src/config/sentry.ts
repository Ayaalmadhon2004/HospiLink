import * as Sentry from '@sentry/node';

// No-op unless SENTRY_DSN is set, so local dev and tests are unaffected.
const dsn = process.env.SENTRY_DSN;

export const sentryEnabled = Boolean(dsn);

export const initSentry = (): void => {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    // Patient data: default PII (bodies, cookies, IPs) is not collected; keep it that way.
    tracesSampleRate: 0,
  });
};

export const captureServerError = (err: unknown): void => {
  if (sentryEnabled) Sentry.captureException(err);
};
