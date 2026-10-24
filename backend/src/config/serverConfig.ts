import type { Server } from 'http';

const SHUTDOWN_TIMEOUT_MS = 10000;

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
