import { useEffect, useState } from 'react';
import { api } from '../services/api';

/** `waking` = the API has not answered for a while (Render free tier cold start). */
export type WarmupStatus = 'checking' | 'waking' | 'ready';

const SHOW_AFTER_MS = 1_500; // quick responses never flash the banner
const RETRY_MS = 3_000;
const ATTEMPT_TIMEOUT_MS = 8_000;
const KEEP_ALIVE_MS = 10 * 60_000; // Render idles a free service after ~15 min without traffic
const HTTP_SERVER_ERROR = 500;

const ping = (): Promise<boolean> =>
  api
    .get('/health', { timeout: ATTEMPT_TIMEOUT_MS })
    .then(() => true)
    // Any answer below 5xx proves the process is up; 5xx (DB still waking) and network errors are retried.
    .catch((err: { status?: number }) => err.status !== undefined && err.status < HTTP_SERVER_ERROR);

/**
 * Polls `GET /api/health` on mount until the API answers, then keeps it warm while the tab is open.
 * Safe for emergency screens: it never blocks the UI, it only reports the status.
 */
export const useBackendWarmup = (): WarmupStatus => {
  const [status, setStatus] = useState<WarmupStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const wakingTimer = setTimeout(() => setStatus((s) => (s === 'checking' ? 'waking' : s)), SHOW_AFTER_MS);

    const poll = async (): Promise<void> => {
      if (await ping()) {
        if (!cancelled) setStatus('ready');
        return;
      }
      if (!cancelled) retryTimer = setTimeout(() => void poll(), RETRY_MS);
    };
    void poll();

    const keepAlive = setInterval(() => {
      if (!document.hidden) void ping();
    }, KEEP_ALIVE_MS);

    return () => {
      cancelled = true;
      clearTimeout(wakingTimer);
      clearTimeout(retryTimer);
      clearInterval(keepAlive);
    };
  }, []);

  return status;
};
