import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { usePatients } from './usePatients';
import { useDebounce } from './useDebounce';
import { getPaginationRange } from '../utils/paginationRange';

/** Filters, paging and admit-modal state for the patients list page. */
export const usePatientsPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('All');
  const [searchInput, setSearchInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Debounce search input (300ms)
  const search = useDebounce(searchInput, 300);

  const { patients, pagination, loading, isFetching, error } = usePatients({
    status: statusFilter,
    search: search || undefined,
    page,
    limit,
  });

  // ─── SEO: Dynamic title ─────────────────────────────────────────
  useEffect(() => {
    document.title = t('patients.documentTitle', { page });
  }, [page, t]);

  const handlePatientAdded = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['patients'] });
    setIsModalOpen(false);
    // Clear filters so the newly admitted patient is visible
    setSearchInput('');
    setStatusFilter('All');
    setPage(1);
  }, [queryClient]);

  const handleStatusChange = useCallback((newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setPage(1);
  }, []);

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  }, []);

  const totalPages = pagination?.totalPages || 1;
  const paginationRange = useMemo(
    () => getPaginationRange(page, totalPages),
    [page, totalPages]
  );

  const startItem = ((page - 1) * limit) + 1;
  const endItem = Math.min(page * limit, pagination?.totalCount || 0);

  return {
    statusFilter, searchInput, search, isModalOpen, setIsModalOpen, page, setPage, limit,
    patients, pagination, loading, isFetching, error,
    handlePatientAdded, handleStatusChange, handleSearchChange, handleLimitChange,
    totalPages, paginationRange, startItem, endItem,
  };
};
