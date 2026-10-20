import type { Metric } from 'web-vitals';

// Anonymous payload: metric name, value, rating and pathname only. No ids, no query string.
export interface VitalsPayload {
  name: string;
  value: number;
  rating: Metric['rating'];
  path: string;
}

const VALUE_PRECISION = 1000; // keep 3 decimals

export const toPayload = (metric: Metric): VitalsPayload => ({
  name: metric.name,
  value: Math.round(metric.value * VALUE_PRECISION) / VALUE_PRECISION,
  rating: metric.rating,
  path: window.location.pathname,
});

// Anonymous, unauthenticated beacon to an optional collector. It intentionally
// bypasses services/api.ts: that instance attaches credentials and targets the API only.
export const sendVital = async (endpoint: string, payload: VitalsPayload): Promise<void> => {
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(endpoint, blob)) return;
    }
    await fetch(endpoint, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      credentials: 'omit',
    });
  } catch {
    // Telemetry must never break the app.
  }
};

export const reportWebVitals = async (): Promise<void> => {
  const endpoint = import.meta.env.VITE_VITALS_ENDPOINT as string | undefined;
  const isDev = !import.meta.env.PROD;
  if (!isDev && !endpoint) return;

  const { onCLS, onINP, onLCP, onFCP, onTTFB } = await import('web-vitals');
  const handle = (metric: Metric): void => {
    const payload = toPayload(metric);
    if (isDev) console.log('[web-vitals]', payload);
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
