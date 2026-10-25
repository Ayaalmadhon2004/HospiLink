// tests-int/helpers/server.ts
//
// Boots the REAL server (src/server.ts: helmet, CORS, rate limits, socket.io, socketAuth, every connection handler) as a child
// process against the throwaway database, so socket tests exercise exactly what production runs.
import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import path from 'path';
import { io, Socket } from 'socket.io-client';
import { bearer, tokenFor } from './factories';

const BACKEND = path.resolve(__dirname, '../..');
const ORIGIN = 'http://localhost:5173';

export interface RunningServer {
  url: string;
  stop: () => Promise<void>;
}

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const startServer = async (): Promise<RunningServer> => {
  const port = await freePort();
  const child: ChildProcess = spawn(path.join(BACKEND, 'node_modules/.bin/tsx'), ['src/server.ts'], {
    cwd: BACKEND,
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test', CORS_ORIGINS: ORIGIN, LOG_LEVEL: 'silent' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
  let exited = false;
  child.on('exit', () => { exited = true; });

  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 45_000;
  for (;;) {
    if (exited) throw new Error(`server exited during start-up:\n${stderr}`);
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) {
      child.kill('SIGKILL');
      throw new Error(`server did not become healthy in time:\n${stderr}`);
    }
    await sleep(250);
  }
  return {
    url,
    stop: () =>
      new Promise((resolve) => {
        if (exited) return resolve();
        child.once('exit', () => resolve());
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 5_000).unref();
      }),
  };
};

/** A connected socket for `userId`, or a rejection with the server's refusal message. Always call `.disconnect()` when done. */
export const connectAs = (server: RunningServer, token: string): Promise<Socket> =>
  new Promise((resolve, reject) => {
    const socket = io(server.url, { auth: { token }, transports: ['websocket'], forceNew: true, reconnection: false, extraHeaders: { Origin: ORIGIN } });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => { socket.close(); reject(err); });
  });

export const connectUser = (server: RunningServer, userId: string, ageSeconds = 0): Promise<Socket> => connectAs(server, tokenFor(userId, ageSeconds));

/** The first payload of `event` within `ms`, or null. Register BEFORE triggering the action. */
export const nextEvent = <T = unknown>(socket: Socket, event: string, ms = 1500): Promise<T | null> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => { socket.off(event, handler); resolve(null); }, ms);
    const handler = (payload: T) => { clearTimeout(timer); resolve(payload); };
    socket.once(event, handler);
  });

/** Records every payload of `event` from now on. */
export const record = <T = unknown>(socket: Socket, event: string): T[] => {
  const seen: T[] = [];
  socket.on(event, (p: T) => seen.push(p));
  return seen;
};

export const settle = (ms = 400) => sleep(ms);

/** Authenticated HTTP call against the booted server. */
export const http = async (server: RunningServer, method: string, pathname: string, userId: string | null, body?: object, headers: Record<string, string> = {}) => {
  const res = await fetch(`${server.url}${pathname}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(userId ? { Authorization: bearer(userId) } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
};
