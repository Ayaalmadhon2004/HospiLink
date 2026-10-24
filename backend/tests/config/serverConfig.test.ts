import { createShutdown } from '../../src/config/serverConfig';

type ServerArg = Parameters<typeof createShutdown>[0]['server'];

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
