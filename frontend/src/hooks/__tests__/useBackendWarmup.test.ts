import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBackendWarmup } from '../useBackendWarmup';

const get = vi.hoisted(() => vi.fn());
vi.mock('../../services/api', () => ({ api: { get } }));

describe('useBackendWarmup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    get.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('becomes ready without showing the waking state when the API answers quickly', async () => {
    get.mockResolvedValue({});
    const { result } = renderHook(() => useBackendWarmup());
    await act(async () => {});
    expect(result.current).toBe('ready');
    expect(get).toHaveBeenCalledWith('/health', expect.objectContaining({ timeout: expect.any(Number) }));
  });

  it('reports waking while the API is cold, retries, then becomes ready', async () => {
    get.mockRejectedValueOnce({ status: undefined }).mockRejectedValueOnce({ status: 503 }).mockResolvedValue({});
    const { result } = renderHook(() => useBackendWarmup());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_600);
    });
    expect(result.current).toBe('waking');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7_000);
    });
    expect(result.current).toBe('ready');
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('treats a non-5xx HTTP answer as awake', async () => {
    get.mockRejectedValue({ status: 404 });
    const { result } = renderHook(() => useBackendWarmup());
    await act(async () => {});
    expect(result.current).toBe('ready');
  });
});
