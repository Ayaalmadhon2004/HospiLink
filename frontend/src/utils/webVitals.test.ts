import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Metric } from 'web-vitals';

const handlers: Record<string, (m: Metric) => void> = {};
vi.mock('web-vitals', () => {
  const make = (name: string) => (cb: (m: Metric) => void) => {
    handlers[name] = cb;
  };
  return {
    onCLS: make('CLS'),
    onINP: make('INP'),
    onLCP: make('LCP'),
    onFCP: make('FCP'),
    onTTFB: make('TTFB'),
  };
});

const RAW_VALUE = 1234.56789;
const ROUNDED_VALUE = 1234.568;
const metric = { name: 'LCP', value: RAW_VALUE, rating: 'good', id: 'secret-id', delta: 1 } as unknown as Metric;

describe('webVitals', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    window.history.pushState({}, '', '/patients?name=John#x');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ['/patients/abc123', '/patients/:id'],
    ['/patients/abc123/edit', '/patients/:id/edit'],
    ['/patients/abc123/', '/patients/:id'],
    ['/patients', '/patients'],
    ['/dashboard', '/dashboard'],
    ['/', '/'],
    ['/something/with/ids/42', '/other'],
  ])('normalizePath maps %s to %s', async (input, expected) => {
    const { normalizePath } = await import('./webVitals');
    expect(normalizePath(input)).toBe(expected);
  });

  it('toPayload keeps only name, value, rating and pathname', async () => {
    const { toPayload } = await import('./webVitals');
    expect(toPayload(metric)).toEqual({ name: 'LCP', value: ROUNDED_VALUE, rating: 'good', path: '/patients', id: 'secret-id' });
  });

  it('registers all five metrics and logs in dev', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { reportWebVitals } = await import('./webVitals');
    await reportWebVitals();
    expect(Object.keys(handlers).sort()).toEqual(['CLS', 'FCP', 'INP', 'LCP', 'TTFB']);
    handlers.LCP(metric);
    expect(log).toHaveBeenCalledWith('[web-vitals]', expect.objectContaining({ name: 'LCP', path: '/patients' }));
  });

  it('does nothing in production without an endpoint', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_VITALS_ENDPOINT', '');
    const { reportWebVitals } = await import('./webVitals');
    await reportWebVitals();
    expect(Object.keys(handlers)).toHaveLength(0);
  });

  it('sends via sendBeacon in production when an endpoint is set, without logging', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_VITALS_ENDPOINT', 'https://vitals.example.test/collect');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const beacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    const { reportWebVitals } = await import('./webVitals');
    await reportWebVitals();
    handlers.LCP(metric);
    expect(beacon).toHaveBeenCalledWith('https://vitals.example.test/collect', expect.any(Blob));
    expect(log).not.toHaveBeenCalled();
  });

  it('sends text/plain so the beacon needs no CORS preflight', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_VITALS_ENDPOINT', 'https://vitals.example.test/collect');
    const beacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    const { reportWebVitals } = await import('./webVitals');
    await reportWebVitals();
    handlers.LCP(metric);
    const blob = beacon.mock.calls[0][1] as Blob;
    expect(blob.type).toContain('text/plain');
    expect(JSON.parse(await blob.text())).not.toHaveProperty('url');
  });

  it('never sends in dev even when an endpoint is set', async () => {
    vi.stubEnv('VITE_VITALS_ENDPOINT', 'https://vitals.example.test/collect');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const beacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    const { reportWebVitals } = await import('./webVitals');
    await reportWebVitals();
    handlers.LCP(metric);
    expect(beacon).not.toHaveBeenCalled();
  });

  it('honours the sample rate (0 disables, invalid means 1)', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_VITALS_ENDPOINT', 'https://vitals.example.test/collect');
    vi.stubEnv('VITE_VITALS_SAMPLE', '0');
    const { reportWebVitals, parseSampleRate } = await import('./webVitals');
    await reportWebVitals();
    expect(Object.keys(handlers)).toHaveLength(0);
    expect(parseSampleRate('abc')).toBe(1);
    expect(parseSampleRate('2')).toBe(1);
    expect(parseSampleRate('0.25')).toBe(0.25);
    expect(parseSampleRate(undefined)).toBe(1);
  });

  it('never throws when sendBeacon and fetch both fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    Object.defineProperty(navigator, 'sendBeacon', {
      value: vi.fn(() => { throw new Error('boom'); }),
      configurable: true,
    });
    const { sendVital } = await import('./webVitals');
    await expect(sendVital('https://x.test/c', { name: 'CLS', value: 0, rating: 'good', path: '/' })).resolves.toBeUndefined();
  });

  it('falls back to fetch with keepalive when sendBeacon refuses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn().mockReturnValue(false), configurable: true });
    const { sendVital } = await import('./webVitals');
    await sendVital('https://vitals.example.test/collect', { name: 'CLS', value: 0, rating: 'good', path: '/' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://vitals.example.test/collect',
      expect.objectContaining({ method: 'POST', keepalive: true, credentials: 'omit' }),
    );
  });
});
