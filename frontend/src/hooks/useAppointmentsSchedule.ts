import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { apiGet } from '../services/api';
import type { Appointment } from '../services/appointmentsService';
import type { ApiResponse } from '../types/api';
import { useAppointmentsSocket } from './useAppointmentsSocket';

export const SCHEDULE_KEY = ['appointments', 'schedule'];

interface Schedule {
  today: Appointment[];
  upcoming: Appointment[];
}

// Today and upcoming load independently: one failing leaves the other list usable.
const fetchSchedule = async (): Promise<Schedule> => {
  const [todayRes, upcomingRes] = await Promise.allSettled([
    // The endpoint returns either a bare list or { appointments }
    apiGet<ApiResponse<Appointment[] & { appointments?: Appointment[] }>>('/appointments/today'),
    apiGet<ApiResponse<Appointment[]>>('/appointments/upcoming'),
  ]);
  if (todayRes.status === 'rejected' && upcomingRes.status === 'rejected') throw todayRes.reason;

  const todayData = todayRes.status === 'fulfilled' ? todayRes.value?.data : undefined;
  const todayList = todayData?.appointments || todayData || [];
  const upcomingList = upcomingRes.status === 'fulfilled' ? upcomingRes.value?.data : undefined;
  return {
    today: Array.isArray(todayList) ? todayList : [],
    upcoming: Array.isArray(upcomingList) ? upcomingList : [],
  };
};

/** Today + upcoming schedule query, with error toast and socket-driven refetch. */
export const useAppointmentsSchedule = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const latestUpdate = useAppointmentsSocket();

  const { data, isPending: loading, isError } = useQuery({ queryKey: SCHEDULE_KEY, queryFn: fetchSchedule });
  const todayAppointments = data?.today ?? [];
  const upcoming = data?.upcoming ?? [];

  useEffect(() => {
    if (isError) toast.error(t('appointments.loadError'));
  }, [isError, t]);

  // A socket update (booked / moved / cancelled elsewhere) refetches both lists.
  useEffect(() => {
    if (latestUpdate) void queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY });
  }, [latestUpdate, queryClient]);

  return { todayAppointments, upcoming, loading };
};
