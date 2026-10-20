import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../types/api';

export interface CrudConfig<T> {
  queryKey: string[];
  deleteFn: (id: string) => Promise<unknown>;
  createFn?: (data: Record<string, unknown>) => Promise<unknown>;
  updateFn?: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  getItemId: (item: T) => string;
  itemName: string; 
}

export interface UseDeleteResult {
  confirmDelete: { id: string; name: string } | null;
  setConfirmDelete: (target: { id: string; name: string } | null) => void;
  handleDeleteClick: (id: string, name: string) => void;
  handleConfirmDelete: () => void;
  isDeleting: boolean;
}

export interface UseCreateResult<T> {
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  editingItem: T | null;
  setEditingItem: (item: T | null) => void;
  handleAdd: () => void;
  handleEdit: (item: T) => void;
  handleModalSuccess: () => void;
}

// ─── useOptimisticDelete ────────────────────────────────────────────

export function useOptimisticDelete<T>(config: CrudConfig<T>): UseDeleteResult {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: config.deleteFn,

    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: config.queryKey });

      // Snapshot previous data
      const previousData = queryClient.getQueryData<T[]>(config.queryKey);

      // Optimistically remove the item
      queryClient.setQueryData<T[]>(config.queryKey, (old) => {
        if (!old) return old;
        return old.filter((item) => config.getItemId(item) !== id);
      });

      // Show success toast immediately
      toast.success(t('crud.deleted', { item: config.itemName }));

      return { previousData };
    },

    onError: (err: unknown, _id: string, context?: { previousData?: T[] }) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(config.queryKey, context.previousData);
      }
      toast.error(getErrorMessage(err, '') || t('crud.deleteFailed', { item: config.itemName.toLowerCase() }));
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: config.queryKey });
    },
  });

  const handleDeleteClick = useCallback((id: string, name: string) => {
    setConfirmDelete({ id, name });
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!confirmDelete) return;
    const { id } = confirmDelete;
    setConfirmDelete(null);
    deleteMutation.mutate(id);
  }, [confirmDelete, deleteMutation]);

  return {
    confirmDelete,
    setConfirmDelete,
    handleDeleteClick,
    handleConfirmDelete,
    isDeleting: deleteMutation.isPending,
  };
}

// ─── useCrudModal ───────────────────────────────────────────────────

export function useCrudModal<T>(): UseCreateResult<T> {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);

  const handleAdd = useCallback(() => {
    setEditingItem(null);
    setIsModalOpen(true);
  }, []);

  const handleEdit = useCallback((item: T) => {
    setEditingItem(item);
    setIsModalOpen(true);
  }, []);

  const handleModalSuccess = useCallback(() => {
    setIsModalOpen(false);
    setEditingItem(null);
  }, []);

  return {
    isModalOpen,
    setIsModalOpen,
    editingItem,
    setEditingItem,
    handleAdd,
    handleEdit,
    handleModalSuccess,
  };
}

// ─── useOptimisticCreate ────────────────────────────────────────────
// شو يساوي اليوز ابوتيمستك بالكريت والابديت 
export function useOptimisticCreate<T>(config: CrudConfig<T>) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: config.createFn!,

    onSuccess: () => {
      toast.success(t('crud.created', { item: config.itemName }));
      queryClient.invalidateQueries({ queryKey: config.queryKey });
    },

    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, '') || t('crud.createFailed', { item: config.itemName.toLowerCase() }));
    },
  });
}

// ─── useOptimisticUpdate ───────────────────────────────────────────

export function useOptimisticUpdate<T>(config: CrudConfig<T>) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => config.updateFn!(id, data),

    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: config.queryKey });
      const previousData = queryClient.getQueryData<T[]>(config.queryKey);

      queryClient.setQueryData<T[]>(config.queryKey, (old) => {
        if (!old) return old;
        return old.map((item) =>
          config.getItemId(item) === id ? { ...item, ...data } : item
        );
      });

      return { previousData };
    },

    onError: (err: unknown, _vars: { id: string; data: Record<string, unknown> }, context?: { previousData?: T[] }) => {
      if (context?.previousData) {
        queryClient.setQueryData(config.queryKey, context.previousData);
      }
      toast.error(getErrorMessage(err, '') || t('crud.updateFailed', { item: config.itemName.toLowerCase() }));
    },

    onSuccess: () => {
      toast.success(t('crud.updated', { item: config.itemName }));
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: config.queryKey });
    },
  });
}