import { useQuery } from '@tanstack/react-query';
import { getPatients } from '../services/patientService';
import { getTodaySchedule } from '../services/appointmentsService';
import { apiGet } from '../services/api';
import type { ApiResponse } from '../types/api';

export type BadgeItemId = 'Patients' | 'Appointments' | 'Vitals' | 'Incidents';

const STALE_TIME = 60_000;

/** Roles allowed by the backend to call each endpoint behind a badge. */
export const BADGE_ROLES: Record<BadgeItemId, readonly string[]> = {
  Patients: ['ADMIN', 'DOCTOR', 'NURSE', 'DISPATCHER'],
  Appointments: ['ADMIN', 'DOCTOR', 'NURSE'],
  Vitals: ['ADMIN', 'DOCTOR', 'NURSE'],
  Incidents: ['ADMIN', 'DOCTOR', 'NURSE'],
};

export const canSeeBadge = (item: BadgeItemId, role?: string): boolean =>
  !!role && BADGE_ROLES[item].includes(role);

/**
 * Turn a raw count into badge text. Returns null (render nothing) while
 * loading/erroring, for invalid numbers and for zero. Large numbers: 1.2k, 12k, 1.5M.
 */
const THOUSAND = 1000;
const MILLION = 1_000_000;
const DECIMAL_BASE = 10;

/** Scale a value, keeping one decimal below 10 (1.2k) and none above (12k). */
const compact = (value: number, suffix: string): string =>
  `${value < DECIMAL_BASE ? Math.floor(value * DECIMAL_BASE) / DECIMAL_BASE : Math.floor(value)}${suffix}`;

export const formatBadge = (count: number | null | undefined): string | null => {
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return null;
  const n = Math.floor(count);
  if (n < THOUSAND) return String(n);
  return n < MILLION ? compact(n / THOUSAND, 'k') : compact(n / MILLION, 'M');
};

export const useSidebarBadges = (role?: string): Record<BadgeItemId, string | null> => {
  const patients = useQuery({
    queryKey: ['sidebar-badge', 'patients'],
    queryFn: async () => (await getPatients({ page: 1, limit: 1 })).pagination?.totalCount ?? null,
    enabled: canSeeBadge('Patients', role),
    staleTime: STALE_TIME,
    retry: false,
  });
  const appointments = useQuery({
    queryKey: ['sidebar-badge', 'appointments-today'],
    queryFn: async () => (await getTodaySchedule()).data?.appointments?.length ?? null,
    enabled: canSeeBadge('Appointments', role),
    staleTime: STALE_TIME,
    retry: false,
  });
  const vitals = useQuery({
    queryKey: ['sidebar-badge', 'patients-critical'],
    queryFn: async () =>
      (await apiGet<ApiResponse<{ count?: number }>>('/patients/critical-count')).data?.count ?? null,
    enabled: canSeeBadge('Vitals', role),
    staleTime: STALE_TIME,
    retry: false,
  });
  const incidents = useQuery({
    queryKey: ['sidebar-badge', 'incidents-active'],
    queryFn: async () =>
      (await apiGet<ApiResponse<{ total?: number }>>('/incidents/active')).data?.total ?? null,
    enabled: canSeeBadge('Incidents', role),
    staleTime: STALE_TIME,
    retry: false,
  });

  return {
    Patients: patients.isSuccess ? formatBadge(patients.data) : null,
    Appointments: appointments.isSuccess ? formatBadge(appointments.data) : null,
    Vitals: vitals.isSuccess ? formatBadge(vitals.data) : null,
    Incidents: incidents.isSuccess ? formatBadge(incidents.data) : null,
  };
};
