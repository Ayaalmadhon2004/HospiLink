// hooks/useCrud.ts
// Generic CRUD hooks with optimistic updates for HospiLink

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────

export interface CrudConfig<T> {
  queryKey: string[];
  deleteFn: (id: string) => Promise<any>;
  createFn?: (data: any) => Promise<any>;
  updateFn?: (id: string, data: any) => Promise<any>;
  getItemId: (item: T) => string;
  itemName: string; // for toast messages: "Bed", "Staff member", etc.
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
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: config.deleteFn,

    onMutate: async (id: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: config.queryKey });

      // Snapshot previous data
      const previousData = queryClient.getQueryData<T[]>(config.queryKey);

      // Optimistically remove the item
      queryClient.setQueryData<T[]>(config.queryKey, (old) => {
        if (!old) return old;
        return old.filter((item) => config.getItemId(item) !== id);
      });

      // Show success toast immediately
      toast.success(`${config.itemName} deleted`);

      return { previousData };
    },

    onError: (err: any, context: any) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(config.queryKey, context.previousData);
      }
      toast.error(err?.message || `Failed to delete ${config.itemName.toLowerCase()}`);
    },

    onSettled: () => {
      // Always refetch to ensure sync
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

export function useOptimisticCreate<T>(config: CrudConfig<T>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: config.createFn!,

    onSuccess: () => {
      toast.success(`${config.itemName} created successfully`);
      queryClient.invalidateQueries({ queryKey: config.queryKey });
    },

    onError: (err: any) => {
      toast.error(err?.message || `Failed to create ${config.itemName.toLowerCase()}`);
    },
  });
}

// ─── useOptimisticUpdate ───────────────────────────────────────────

export function useOptimisticUpdate<T>(config: CrudConfig<T>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => config.updateFn!(id, data),

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

    onError: (err: any,  context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(config.queryKey, context.previousData);
      }
      toast.error(err?.message || `Failed to update ${config.itemName.toLowerCase()}`);
    },

    onSuccess: () => {
      toast.success(`${config.itemName} updated successfully`);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: config.queryKey });
    },
  });
}