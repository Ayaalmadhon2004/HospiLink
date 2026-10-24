import { describe, it, expect, afterEach, vi } from 'vitest';
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { api, apiGet } from '../api';
import { setSessionExpiredHandler } from '../sessionExpiry';

const originalAdapter = api.defaults.adapter;

const failWith =
  (status: number | undefined, data?: unknown, message = 'Request failed'): AxiosAdapter =>
  (config: InternalAxiosRequestConfig) => {
    const response =
      status === undefined ? undefined : { status, statusText: '', data, headers: {}, config };
    return Promise.reject(new AxiosError(message, 'ERR', config, null, response));
  };

describe('api response interceptor', () => {
  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it('normalises 403 to a permission message', async () => {
    api.defaults.adapter = failWith(403, { message: 'ignored' });
    await expect(apiGet('/x')).rejects.toThrow('You do not have permission to perform this action.');
  });

  it('normalises 5xx to a generic server error', async () => {
    api.defaults.adapter = failWith(500, { message: 'stack trace here' });
    await expect(apiGet('/x')).rejects.toThrow('Server error. Please try again later.');
    api.defaults.adapter = failWith(503);
    await expect(apiGet('/x')).rejects.toThrow('Server error. Please try again later.');
  });

  it('uses response.data.message when present', async () => {
    api.defaults.adapter = failWith(400, { message: 'Email already in use' });
    await expect(apiGet('/x')).rejects.toThrow('Email already in use');
  });

  it('falls back to response.data.error, then to the axios message', async () => {
    api.defaults.adapter = failWith(404, { error: 'Not found' });
    await expect(apiGet('/x')).rejects.toThrow('Not found');
    api.defaults.adapter = failWith(undefined, undefined, 'Network Error');
    await expect(apiGet('/x')).rejects.toThrow('Network Error');
  });

  it('rejects with a plain Error instance and passes successful responses through', async () => {
    api.defaults.adapter = failWith(400, { message: 'bad' });
    await expect(apiGet('/x')).rejects.toBeInstanceOf(Error);

    api.defaults.adapter = (config) =>
      Promise.resolve({ status: 200, statusText: 'OK', data: { ok: true }, headers: {}, config });
    await expect(apiGet('/x')).resolves.toEqual({ ok: true });
  });

  it('reports 401 to the session-expired handler, but not other statuses', async () => {
    const onExpired = vi.fn();
    const unregister = setSessionExpiredHandler(onExpired);
    api.defaults.adapter = failWith(403, {});
    await expect(apiGet('/x')).rejects.toThrow();
    expect(onExpired).not.toHaveBeenCalled();
    api.defaults.adapter = failWith(401, { message: 'jwt expired' });
    await expect(apiGet('/x')).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledTimes(1);
    unregister();
  });
});
