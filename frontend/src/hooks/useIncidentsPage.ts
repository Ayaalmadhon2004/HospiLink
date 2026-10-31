import { logger } from '../utils/logger';
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getIncidents, deleteIncident, updateIncidentStatus } from '../services/incidentsService';
import { useIncidentsSocket } from './useIncidentsSocket';
import { useNow } from './useNow';
import { useOptimisticDelete, useCrudModal } from './useCrud';
import type { Incident } from '../components/Incidents/incidentTypes';

const INCIDENTS_KEY = ['incidents'];
const RELATIVE_TIME_TICK_MS = 60_000;

/** Data, filters, status updates and CRUD modal state of the incidents page. */
export const useIncidentsPage = () => {

  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const now = useNow(RELATIVE_TIME_TICK_MS);

  // Shared CRUD hooks
  const { confirmDelete, handleDeleteClick, handleConfirmDelete, isDeleting } =
    useOptimisticDelete<Incident>({
      queryKey: ['incidents'],
      deleteFn: (id: string) => deleteIncident(id),
      getItemId: (inc) => inc.id,
      itemName: t('incidents.itemName'),
    });

  const { isModalOpen, editingItem, handleAdd, handleEdit, handleModalSuccess } =
    useCrudModal<Incident>();

  const latestUpdate = useIncidentsSocket();

  const { data: incidents = [], isPending: loading } = useQuery({
    queryKey: INCIDENTS_KEY,
    queryFn: async () => (await getIncidents())?.data || [],
  });
  const refreshIncidents = useCallback(
    () => queryClient.invalidateQueries({ queryKey: INCIDENTS_KEY }),
    [queryClient],
  );

  // A socket update (created / changed / resolved elsewhere) refetches the list.
  useEffect(() => {
    if (latestUpdate) void refreshIncidents();
  }, [latestUpdate, refreshIncidents]);

  const handleModalSuccessWithRefresh = () => {
    handleModalSuccess();
    void refreshIncidents();
  };

  // ✅ NEW: Update status + progress
  const handleStatusChange = async (
    id: string,
    newStatus: string,
    progress?: number
  ) => {
    setUpdatingStatus(id);
    try {
      await updateIncidentStatus(id, newStatus, progress);
      void refreshIncidents();
    } catch (err) {
      logger.error('Failed to update status:', err);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch =
      inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = !filterSeverity || inc.severity === filterSeverity;
    return matchesSearch && matchesSeverity;
  });

  const timeAgo = (dateStr: string) => {
    const diff = now - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return t('incidents.minutesAgo', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('incidents.hoursAgo', { count: hours });
    return t('incidents.daysAgo', { count: Math.floor(hours / 24) });
  };

  return {
    incidents, loading, filteredIncidents, searchQuery, setSearchQuery, filterSeverity, setFilterSeverity,
    updatingStatus, handleStatusChange, timeAgo, confirmDelete, handleDeleteClick, handleConfirmDelete, isDeleting,
    isModalOpen, editingItem, handleAdd, handleEdit, handleModalSuccess, handleModalSuccessWithRefresh,
  };
};
