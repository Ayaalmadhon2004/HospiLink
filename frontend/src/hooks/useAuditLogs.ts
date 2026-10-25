import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getAuditLogs, getAuditActions, type AuditLogFilters } from '../services/auditLogService';

/** Server-side filtered, paginated audit trail. Changing a filter goes back to page 1. */
export const useAuditLogs = () => {
  const [filters, setFiltersState] = useState<AuditLogFilters>({});
  const [page, setPage] = useState(1);

  const logs = useQuery({
    queryKey: ['audit-logs', filters, page],
    queryFn: () => getAuditLogs(filters, page),
    placeholderData: keepPreviousData,
  });
  const actions = useQuery({ queryKey: ['audit-logs', 'actions'], queryFn: getAuditActions, staleTime: 5 * 60 * 1000 });

  const setFilters = (next: AuditLogFilters) => {
    setFiltersState(next);
    setPage(1);
  };

  return { filters, setFilters, page, setPage, logs, actions: actions.data ?? [] };
};
