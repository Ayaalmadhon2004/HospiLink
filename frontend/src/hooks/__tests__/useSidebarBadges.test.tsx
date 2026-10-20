import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { canSeeBadge, formatBadge, useSidebarBadges } from '../useSidebarBadges';
import * as patientService from '../../services/patientService';
import * as appointmentsService from '../../services/appointmentsService';
import * as api from '../../services/api';

vi.mock('../../services/patientService', () => ({ getPatients: vi.fn() }));
vi.mock('../../services/appointmentsService', () => ({ getTodaySchedule: vi.fn() }));
vi.mock('../../services/api', () => ({ apiGet: vi.fn() }));

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('formatBadge', () => {
  it('hides null, undefined, zero, negatives and NaN', () => {
    [null, undefined, 0, -3, NaN].forEach((v) => expect(formatBadge(v)).toBeNull());
  });
  it('shows small numbers as-is', () => {
    expect(formatBadge(7)).toBe('7');
    expect(formatBadge(999)).toBe('999');
  });
  it('formats large numbers', () => {
    expect(formatBadge(1000)).toBe('1k');
    expect(formatBadge(1234)).toBe('1.2k');
    expect(formatBadge(12500)).toBe('12k');
    expect(formatBadge(2_500_000)).toBe('2.5M');
  });
});

describe('canSeeBadge', () => {
  it('limits appointments, vitals and incidents to ADMIN/DOCTOR/NURSE', () => {
    expect(canSeeBadge('Vitals', 'DISPATCHER')).toBe(false);
    expect(canSeeBadge('Vitals', 'DOCTOR')).toBe(true);
    expect(canSeeBadge('Appointments', 'DISPATCHER')).toBe(false);
    expect(canSeeBadge('Incidents', 'DISPATCHER')).toBe(false);
    expect(canSeeBadge('Incidents', 'NURSE')).toBe(true);
  });
  it('lets dispatchers see the patients badge, but not anonymous users', () => {
    expect(canSeeBadge('Patients', 'DISPATCHER')).toBe(true);
    expect(canSeeBadge('Patients', undefined)).toBe(false);
  });
});

describe('useSidebarBadges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(patientService.getPatients).mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 1, totalCount: 1234, totalPages: 1234 },
    });
    vi.mocked(appointmentsService.getTodaySchedule).mockResolvedValue({
      data: { appointments: [{}, {}, {}] as never[] },
    });
    vi.mocked(api.apiGet).mockImplementation((async (url: string) =>
      url === '/patients/critical-count' ? { data: { count: 5 } } : { data: { total: 0 } }) as never);
  });

  it('renders nothing while loading, then real counts (zero hidden)', async () => {
    const { result } = renderHook(() => useSidebarBadges('ADMIN'), { wrapper });
    expect(result.current).toEqual({ Patients: null, Appointments: null, Vitals: null, Incidents: null });
    await waitFor(() => expect(result.current.Patients).toBe('1.2k'));
    await waitFor(() => expect(result.current.Appointments).toBe('3'));
    await waitFor(() => expect(result.current.Vitals).toBe('5'));
    expect(result.current.Incidents).toBeNull();
  });

  it('does not call endpoints the role cannot access', async () => {
    const { result } = renderHook(() => useSidebarBadges('DISPATCHER'), { wrapper });
    await waitFor(() => expect(result.current.Patients).toBe('1.2k'));
    expect(appointmentsService.getTodaySchedule).not.toHaveBeenCalled();
    expect(api.apiGet).not.toHaveBeenCalled();
    expect(result.current.Appointments).toBeNull();
    expect(result.current.Vitals).toBeNull();
    expect(result.current.Incidents).toBeNull();
  });

  it('hides the vitals badge when the critical count request fails', async () => {
    vi.mocked(api.apiGet).mockImplementation((async (url: string) => {
      if (url === '/patients/critical-count') throw new Error('boom');
      return { data: { total: 2 } };
    }) as never);
    const { result } = renderHook(() => useSidebarBadges('NURSE'), { wrapper });
    await waitFor(() => expect(result.current.Incidents).toBe('2'));
    expect(result.current.Vitals).toBeNull();
  });

  it('renders nothing on error', async () => {
    vi.mocked(patientService.getPatients).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useSidebarBadges('ADMIN'), { wrapper });
    await waitFor(() => expect(result.current.Appointments).toBe('3'));
    expect(result.current.Patients).toBeNull();
  });
});
