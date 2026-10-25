// services/auditLogService.ts
import { apiGet } from './api';
import type { ApiResponse, Pagination, QueryParams } from '../types/api';

export interface AuditLogEntry {
  id: string;
  action: string;
  entityId: string;
  details: string | null;
  createdAt: string;
  /** null when the account was deleted afterwards (the trail outlives users). */
  user: { id: string; name: string; email: string; role: string } | null;
}

export interface AuditLogFilters {
  action?: string;
  userId?: string;
  entityId?: string;
  /** ISO instants, `from` inclusive and `to` exclusive. */
  from?: string;
  to?: string;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  pagination?: Pagination;
}

export const AUDIT_PAGE_SIZE = 50;

export const getAuditLogs = async (filters: AuditLogFilters, page: number): Promise<AuditLogPage> => {
  const res = await apiGet<ApiResponse<AuditLogEntry[]> & { pagination?: Pagination }>('/audit-logs', {
    ...(filters as QueryParams),
    page,
    limit: AUDIT_PAGE_SIZE,
  });
  return { items: res.data, pagination: res.pagination };
};

export const getAuditActions = async (): Promise<string[]> => (await apiGet<ApiResponse<string[]>>('/audit-logs/actions')).data;
