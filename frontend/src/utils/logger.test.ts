import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadLogger(prod: boolean) {
  vi.resetModules();
  vi.stubEnv('PROD', prod);
  return (await import('./logger')).logger;
}

function spyConsole() {
  return {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  };
}

describe('logger', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('forwards to console outside production', async () => {
    const spies = spyConsole();
    const logger = await loadLogger(false);
    logger.log('a', 1);
    logger.warn('b');
    logger.error('c');
    expect(spies.log).toHaveBeenCalledWith('a', 1);
    expect(spies.warn).toHaveBeenCalledWith('b');
    expect(spies.error).toHaveBeenCalledWith('c');
  });

  it('is silent in production', async () => {
    const spies = spyConsole();
    const logger = await loadLogger(true);
    logger.log('a');
    logger.warn('b');
    logger.error('c');
    expect(spies.log).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
    expect(spies.error).not.toHaveBeenCalled();
  });
});
