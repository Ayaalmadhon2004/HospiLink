import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { ApiError } from '../apiError';
import { api, apiGet, apiPost, apiPut, apiPatch, apiDelete, apiUpload } from '../api';

const originalAdapter = api.defaults.adapter;

const failWith =
  (status: number, data: unknown): AxiosAdapter =>
  (config: InternalAxiosRequestConfig) =>
    Promise.reject(
      new AxiosError('Request failed', 'ERR', config, null, { status, statusText: '', data, headers: {}, config }),
    );

describe('api helper methods', () => {
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

  it('apiUpload sends the FormData untouched as multipart and returns response.data', async () => {
    const form = new FormData();
    form.append('reportFile', new File(['x'], 'r.pdf', { type: 'application/pdf' }));
    await expect(apiUpload('/upload', form)).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('post');
    expect(calls[0].data).toBeInstanceOf(FormData);
  });

  it('rejects with an ApiError carrying the status and the server code', async () => {
    api.defaults.adapter = failWith(409, { success: false, error: { code: 'CONFLICT', message: 'Bed already taken' } });
    const error = await apiGet('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: 'Bed already taken', code: 'CONFLICT', status: 409 });
  });
});
