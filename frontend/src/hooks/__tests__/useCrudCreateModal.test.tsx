import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useOptimisticCreate, useCrudModal, type CrudConfig } from '../useCrud';

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

const setup = (createFn: CrudConfig<Item>['createFn']) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(KEY, initial);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const config: CrudConfig<Item> = {
    queryKey: KEY,
    deleteFn: vi.fn(),
    createFn,
    getItemId: (i) => i.id,
    itemName: 'Item',
  };
  return { client, wrapper, config };
};

describe('useOptimisticCreate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('toasts and refetches the list on success', async () => {
    const { client, wrapper, config } = setup(vi.fn().mockResolvedValue(undefined));
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useOptimisticCreate(config), { wrapper });

    act(() => result.current.mutate({ name: 'New' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Item created successfully'));
    expect(config.createFn).toHaveBeenCalledWith({ name: 'New' }, expect.anything());
    expect(spy).toHaveBeenCalledWith({ queryKey: KEY });
  });

  it('shows the error message and leaves the cache untouched on failure', async () => {
    const { client, wrapper, config } = setup(vi.fn().mockRejectedValue(new Error('dup')));
    const { result } = renderHook(() => useOptimisticCreate(config), { wrapper });

    act(() => result.current.mutate({ name: 'New' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('dup'));
    expect(toast.success).not.toHaveBeenCalled();
    expect(client.getQueryData<Item[]>(KEY)).toEqual(initial);
  });

  it('falls back to a generic message when the error has none', async () => {
    const { wrapper, config } = setup(vi.fn().mockRejectedValue(new Error('')));
    const { result } = renderHook(() => useOptimisticCreate(config), { wrapper });
    act(() => result.current.mutate({}));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to create item'));
  });
});

describe('useCrudModal', () => {
  it('opens for add with no item, opens for edit with the item, and resets on success', () => {
    const { result } = renderHook(() => useCrudModal<Item>());

    act(() => result.current.handleEdit(initial[0]));
    expect(result.current.isModalOpen).toBe(true);
    expect(result.current.editingItem).toEqual(initial[0]);

    act(() => result.current.handleAdd());
    expect(result.current.isModalOpen).toBe(true);
    expect(result.current.editingItem).toBeNull();

    act(() => result.current.handleEdit(initial[1]));
    act(() => result.current.handleModalSuccess());
    expect(result.current.isModalOpen).toBe(false);
    expect(result.current.editingItem).toBeNull();
  });
});
