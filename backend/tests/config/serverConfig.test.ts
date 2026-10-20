import { buildAllowedOrigins, parsePort, createShutdown } from '../../src/config/serverConfig';

const DEFAULT_PORT = 5000;
const CUSTOM_PORT = 8080;
const OUT_OF_RANGE_PORT = '70000';
type ServerArg = Parameters<typeof createShutdown>[0]['server'];

describe('buildAllowedOrigins', () => {
  it('has no origin with whitespace', () => {
    expect(buildAllowedOrigins('').every((o) => o === o.trim())).toBe(true);
    expect(buildAllowedOrigins('')).toContain('http://localhost:4173');
  });

  it('merges, trims and de-duplicates extra origins', () => {
    const origins = buildAllowedOrigins(' https://a.example.com/ , http://localhost:5173,,');
    expect(origins).toContain('https://a.example.com');
    expect(origins.filter((o) => o === 'http://localhost:5173')).toHaveLength(1);
  });
});

describe('parsePort', () => {
  it('parses numeric strings', () => expect(parsePort(String(CUSTOM_PORT))).toBe(CUSTOM_PORT));
  it('falls back on invalid values', () => {
    expect(parsePort(undefined)).toBe(DEFAULT_PORT);
    expect(parsePort('abc')).toBe(DEFAULT_PORT);
    expect(parsePort(OUT_OF_RANGE_PORT)).toBe(DEFAULT_PORT);
  });
});

describe('createShutdown', () => {
  const log = { info: jest.fn(), error: jest.fn() };

  it('closes server, disconnects db and exits 0 once', async () => {
    const server = { close: jest.fn((cb: (e?: Error) => void) => cb()) };
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const exit = jest.fn();
    const shutdown = createShutdown({ server: server as unknown as ServerArg, disconnect, log, exit });
    await shutdown('SIGTERM');
    await shutdown('SIGTERM');
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('exits 1 when closing fails', async () => {
    const server = { close: jest.fn((cb: (e?: Error) => void) => cb(new Error('x'))) };
    const exit = jest.fn();
    const shutdown = createShutdown({ server: server as unknown as ServerArg, disconnect: jest.fn(), log, exit });
    await shutdown('SIGTERM');
    expect(exit).toHaveBeenCalledWith(1);
  });
});
