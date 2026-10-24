import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPatients } from '../services/patientService';
import { getCriticalAlerts, getVitals, recordVitals } from '../services/vitalsService';
import { useVitalsSocket } from './useVitalsSocket';
import type { Vitals } from '../types/vitals';

const POLLING_INTERVAL = 30_000;
const HISTORY_LIMIT = 20;

const historyKey = (patientId: string) => ['vitals', 'history', patientId] as const;

/** Newest first, no duplicates (a reading can arrive by socket and by the POST response). */
const prependReading = (history: readonly Vitals[], reading: Vitals): Vitals[] =>
  history.some((item) => item.id === reading.id) ? [...history] : [reading, ...history].slice(0, HISTORY_LIMIT);

/**
 * Data of the vitals monitor: patient list and critical alerts (polled), the history of the selected patient
 * (kept live by the socket) and the mutation that records a new reading.
 */
export const useVitalsMonitor = (patientId: string) => {
  const queryClient = useQueryClient();

  const patients = useQuery({
    queryKey: ['vitals', 'patients'],
    queryFn: async () => (await getPatients()).data ?? [],
    refetchInterval: POLLING_INTERVAL,
  });

  // Alerts are optional: when they fail the panel simply stays empty.
  const alerts = useQuery({
    queryKey: ['vitals', 'alerts'],
    queryFn: async () => (await getCriticalAlerts()).data ?? [],
    refetchInterval: POLLING_INTERVAL,
    retry: false,
  });

  const history = useQuery({
    queryKey: historyKey(patientId),
    queryFn: async () => (await getVitals({ patientId, limit: HISTORY_LIMIT })).data ?? [],
    enabled: patientId !== '',
  });

  const { latestVital } = useVitalsSocket(patientId);
  useEffect(() => {
    if (!latestVital || latestVital.patientId !== patientId) return;
    queryClient.setQueryData<Vitals[]>(historyKey(patientId), (prev) => prependReading(prev ?? [], latestVital));
  }, [latestVital, patientId, queryClient]);

  const record = useMutation({
    mutationFn: recordVitals,
    onSuccess: (res, input) => {
      if (res.data) {
        queryClient.setQueryData<Vitals[]>(historyKey(input.patientId), (prev) => prependReading(prev ?? [], res.data));
      }
      void queryClient.invalidateQueries({ queryKey: ['vitals', 'alerts'] });
    },
  });

  return {
    patients: patients.data ?? [],
    patientsLoading: patients.isPending,
    alerts: alerts.data ?? [],
    history: patientId ? (history.data ?? []) : [],
    refreshing: patients.isFetching || alerts.isFetching,
    /** Refetches the patient list and the alerts; resolves to false when the patient list could not be loaded. */
    refresh: async (): Promise<boolean> => {
      const [patientsResult] = await Promise.all([patients.refetch(), alerts.refetch()]);
      return !patientsResult.isError;
    },
    record,
  };
};
