import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { api, apiGet, apiPost, apiPut, apiPatch, apiDelete, apiFetch } from '../api';

const originalAdapter = api.defaults.adapter;

const failWith =
  (status: number, data: unknown): AxiosAdapter =>
  (config: InternalAxiosRequestConfig) =>
    Promise.reject(
      new AxiosError('Request failed', 'ERR', config, null, { status, statusText: '', data, headers: {}, config }),
    );

describe('api helper methods and apiFetch', () => {
  const calls: { method?: string; url?: string; data?: unknown; params?: unknown }[] = [];

  beforeEach(() => {
    calls.length = 0;
    api.defaults.adapter = (config) => {
      calls.push({ method: config.method, url: config.url, data: config.data, params: config.params });
      return Promise.resolve({ status: 200, statusText: 'OK', data: { ok: true }, headers: {}, config });
    };
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it('sends the verb, url, params and body and returns response.data', async () => {
    await expect(apiGet('/a', { q: 'x' })).resolves.toEqual({ ok: true });
    await apiPost('/b', { n: 1 });
    await apiPut('/c', { n: 2 });
    await apiPatch('/d', { n: 3 });
    await apiDelete('/e');
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['get', '/a'],
      ['post', '/b'],
      ['put', '/c'],
      ['patch', '/d'],
      ['delete', '/e'],
    ]);
    expect(calls[0].params).toEqual({ q: 'x' });
    expect(JSON.parse(calls[1].data as string)).toEqual({ n: 1 });
  });

  it('apiFetch parses a JSON body and exposes a fetch-like success response', async () => {
    const res = await apiFetch('/x', { method: 'post', body: JSON.stringify({ a: 1 }) });
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await res.text()).toBe('{"ok":true}');
    expect(JSON.parse(calls[0].data as string)).toEqual({ a: 1 });
  });

  it('apiFetch defaults to GET', async () => {
    await apiFetch('/x');
    expect(calls[0].method).toBe('get');
  });

  it('apiFetch turns failures into ok:false with a message, without throwing', async () => {
    api.defaults.adapter = failWith(404, { error: 'Not found' });
    const res = await apiFetch('/x');
    expect(res.ok).toBe(false);
    // the response interceptor has already normalised the error into a plain Error (no .response)
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('Not found');
  });

  it('apiFetch reports an unsupported method as a 500 result', async () => {
    const res = await apiFetch('/x', { method: 'TRACE' });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('Unsupported method: TRACE');
  });
});
