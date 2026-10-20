import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useOptimisticUpdate, useOptimisticDelete, type CrudConfig } from '../useCrud';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

interface Item {
  id: string;
  name: string;
}

const KEY = ['items'];
const initial: Item[] = [
  { id: '1', name: 'One' },
  { id: '2', name: 'Two' },
];

const setup = (overrides: Partial<CrudConfig<Item>>) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(KEY, initial);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const config: CrudConfig<Item> = {
    queryKey: KEY,
    deleteFn: vi.fn().mockResolvedValue(undefined),
    updateFn: vi.fn().mockResolvedValue(undefined),
    getItemId: (i) => i.id,
    itemName: 'Item',
    ...overrides,
  };
  return { client, wrapper, config };
};

const deferred = () => {
  let resolve!: (v?: unknown) => void;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('useOptimisticUpdate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies the change to the cache before the request settles', async () => {
    const d = deferred();
    const { client, wrapper, config } = setup({ updateFn: vi.fn(() => d.promise) });
    const { result } = renderHook(() => useOptimisticUpdate(config), { wrapper });

    act(() => result.current.mutate({ id: '1', data: { name: 'Changed' } }));

    await waitFor(() =>
      expect(client.getQueryData<Item[]>(KEY)?.[0]).toEqual({ id: '1', name: 'Changed' }),
    );
    expect(client.getQueryData<Item[]>(KEY)?.[1]).toEqual({ id: '2', name: 'Two' });

    d.resolve();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Item updated successfully'));
  });

  it('rolls back the cache and shows an error when the request fails', async () => {
    const { client, wrapper, config } = setup({
      updateFn: vi.fn().mockRejectedValue(new Error('nope')),
    });
    const { result } = renderHook(() => useOptimisticUpdate(config), { wrapper });

    act(() => result.current.mutate({ id: '1', data: { name: 'Changed' } }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('nope'));
    expect(client.getQueryData<Item[]>(KEY)).toEqual(initial);
  });
});

describe('useOptimisticDelete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes the item optimistically after confirmation', async () => {
    const d = deferred();
    const { client, wrapper, config } = setup({ deleteFn: vi.fn(() => d.promise) });
    const { result } = renderHook(() => useOptimisticDelete(config), { wrapper });

    act(() => result.current.handleDeleteClick('1', 'One'));
    expect(result.current.confirmDelete).toEqual({ id: '1', name: 'One' });

    act(() => result.current.handleConfirmDelete());
    await waitFor(() => expect(client.getQueryData<Item[]>(KEY)).toEqual([initial[1]]));
    expect(result.current.confirmDelete).toBeNull();
    d.resolve();
  });

  it('restores the removed item when deletion fails', async () => {
    const { client, wrapper, config } = setup({
      deleteFn: vi.fn().mockRejectedValue(new Error('cannot delete')),
    });
    const { result } = renderHook(() => useOptimisticDelete(config), { wrapper });

    act(() => result.current.handleDeleteClick('1', 'One'));
    act(() => result.current.handleConfirmDelete());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('cannot delete'));
    expect(client.getQueryData<Item[]>(KEY)).toEqual(initial);
  });

  it('does nothing when confirm is called without a target', () => {
    const { wrapper, config } = setup({});
    const { result } = renderHook(() => useOptimisticDelete(config), { wrapper });
    act(() => result.current.handleConfirmDelete());
    expect(config.deleteFn).not.toHaveBeenCalled();
  });
});
