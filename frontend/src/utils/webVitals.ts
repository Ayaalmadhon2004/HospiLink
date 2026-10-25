import type { Metric } from 'web-vitals';
import { logger } from './logger';

// Anonymous payload: metric name, value, rating and a normalised route (no record ids, no query string).
export interface VitalsPayload {
  name: string;
  value: number;
  rating: Metric['rating'];
  path: string;
  id?: string; // per-page-load random id from web-vitals (not user related); lets the collector de-duplicate
}

const VALUE_PRECISION = 1000; // keep 3 decimals
const UNKNOWN_PATH = '/other';

// Known routes (mirrors App.tsx). Dynamic segments are replaced by their param name so record ids
// never leave the browser; any pathname that matches nothing is reported as UNKNOWN_PATH.
const ROUTE_PATTERNS: ReadonlyArray<{ regex: RegExp; template: string }> = [
  { regex: /^\/patients\/[^/]+\/edit$/, template: '/patients/:id/edit' },
  { regex: /^\/patients\/[^/]+$/, template: '/patients/:id' },
];
const STATIC_PATHS: ReadonlySet<string> = new Set([
  '/login', '/signup', '/dashboard', '/patients', '/beds', '/appointments',
  '/dispatch', '/vitals', '/incidents', '/staff', '/settings',
]);

export const normalizePath = (pathname: string): string => {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (trimmed === '/' || STATIC_PATHS.has(trimmed)) return trimmed;
  return ROUTE_PATTERNS.find(({ regex }) => regex.test(trimmed))?.template ?? UNKNOWN_PATH;
};

const SAFE_ID = /^[A-Za-z0-9._-]{1,64}$/;

export const toPayload = (metric: Metric): VitalsPayload => ({
  name: metric.name,
  value: Math.round(metric.value * VALUE_PRECISION) / VALUE_PRECISION,
  rating: metric.rating,
  path: normalizePath(window.location.pathname),
  ...(typeof metric.id === 'string' && SAFE_ID.test(metric.id) ? { id: metric.id } : {}),
});

// Optional VITE_VITALS_SAMPLE (0..1, default 1): decided once per page load so a session is either fully
// reported or not at all. Invalid values fall back to 1.
export const parseSampleRate = (raw: string | undefined): number => {
  if (raw === undefined || raw.trim() === '') return 1;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 1;
};

// Anonymous, unauthenticated beacon to an optional collector. It intentionally
// bypasses services/api.ts: that instance attaches credentials and targets the API only.
export const sendVital = async (endpoint: string, payload: VitalsPayload): Promise<void> => {
  const body = JSON.stringify(payload);
  try {
    // text/plain keeps this a CORS "simple" request: no preflight, so the beacon also works cross-origin.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
      if (navigator.sendBeacon(endpoint, blob)) return;
    }
    await fetch(endpoint, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      keepalive: true,
      credentials: 'omit',
    });
  } catch {
    // Telemetry must never break the app.
  }
};

export const reportWebVitals = async (): Promise<void> => {
  const rawEndpoint = import.meta.env.VITE_VITALS_ENDPOINT as string | undefined;
  const isDev = !import.meta.env.PROD;
  // Sending happens only in production builds with an endpoint, and only for sampled-in page loads.
  const sampleRate = parseSampleRate(import.meta.env.VITE_VITALS_SAMPLE as string | undefined);
  const endpoint = !isDev && rawEndpoint && Math.random() < sampleRate ? rawEndpoint : undefined;
  if (!isDev && !endpoint) return;

  const { onCLS, onINP, onLCP, onFCP, onTTFB } = await import('web-vitals');
  const handle = (metric: Metric): void => {
    const payload = toPayload(metric);
    if (isDev) logger.log('[web-vitals]', payload);
    if (endpoint) void sendVital(endpoint, payload);
  };
  [onCLS, onINP, onLCP, onFCP, onTTFB].forEach((observe) => observe(handle));
};

// Defer until the page has loaded so measurement never competes with startup.
export const initWebVitals = (): void => {
  const run = async (): Promise<void> => {
    try {
      await reportWebVitals();
    } catch {
      // Telemetry must never break the app.
    }
  };
  if (document.readyState === 'complete') void run();
  else window.addEventListener('load', () => void run(), { once: true });
};
