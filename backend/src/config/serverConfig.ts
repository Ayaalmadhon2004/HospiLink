import type { Server } from 'http';

const DEFAULT_PORT = 5000;
const MAX_PORT = 65535;
const SHUTDOWN_TIMEOUT_MS = 10000;

export const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://hospi-link-liart.vercel.app',
  'https://hospi-link-two.vercel.app',
];

/** Merge default origins with an optional comma separated CORS_ORIGINS value. */
export const buildAllowedOrigins = (extra: string | undefined = process.env.CORS_ORIGINS): string[] => {
  const extras = (extra || '')
    .split(',')
    // Strips trailing slashes: "https://a.com/" -> "https://a.com"; "https://a.com" is unchanged.
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_ORIGINS, ...extras]));
};

/** Parse PORT as a number, falling back to the default when missing or invalid. */
export const parsePort = (value: string | undefined, fallback = DEFAULT_PORT): number => {
  const port = Number.parseInt(value ?? '', 10);
  return Number.isInteger(port) && port > 0 && port <= MAX_PORT ? port : fallback;
};

interface ShutdownDeps {
  server: Pick<Server, 'close'>;
  disconnect: () => Promise<unknown>;
  log: { info: (msg: string) => void; error: (obj: unknown, msg: string) => void };
  exit: (code: number) => void;
  timeoutMs?: number;
}

/** Returns a handler that closes the HTTP server, disconnects the DB, then exits. */
export const createShutdown = ({ server, disconnect, log, exit, timeoutMs = SHUTDOWN_TIMEOUT_MS }: ShutdownDeps) => {
  let shuttingDown = false;
  return async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`${signal} received, shutting down gracefully`);
    const timer = setTimeout(() => {
      log.error({}, 'Graceful shutdown timed out, forcing exit');
      exit(1);
    }, timeoutMs);
    timer.unref?.();
    try {
      await new Promise<void>((resolve, reject) =>
        server.close((err?: Error) => (err ? reject(err) : resolve())),
      );
      await disconnect();
      clearTimeout(timer);
      exit(0);
    } catch (err) {
      log.error({ err }, 'Error during shutdown');
      clearTimeout(timer);
      exit(1);
    }
  };
};
