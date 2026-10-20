import { describe, it, expect, vi } from 'vitest';
import { pwaOptions } from '../pwa.config';

vi.mock('virtual:pwa-register', () => ({ registerSW: vi.fn() }));

describe('pwa config', () => {
  it('declares an installable manifest', () => {
    const m = pwaOptions.manifest;
    expect(m && m.name).toBe('HospiLink');
    expect(m && m.display).toBe('standalone');
    const icons = (m && m.icons) || [];
    expect(icons.some((i) => i.sizes === '192x192')).toBe(true);
    expect(icons.some((i) => i.sizes === '512x512')).toBe(true);
    expect(icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  it('never caches API or socket traffic at runtime', () => {
    expect(pwaOptions.workbox?.runtimeCaching).toEqual([]);
    const deny = pwaOptions.workbox?.navigateFallbackDenylist ?? [];
    expect(deny.some((r) => r.test('/api/patients'))).toBe(true);
    expect(deny.some((r) => r.test('/socket.io/?EIO=4'))).toBe(true);
    expect(deny.some((r) => r.test('/patients'))).toBe(false);
  });
});

describe('registerPwa', () => {
  it('does not register outside production', async () => {
    const { registerSW } = await import('virtual:pwa-register');
    const { registerPwa } = await import('./pwa');
    registerPwa();
    expect(registerSW).not.toHaveBeenCalled();
  });
});
