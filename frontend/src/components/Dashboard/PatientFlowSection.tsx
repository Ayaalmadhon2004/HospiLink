import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getPatientFlow } from '../../services/patientService';
import { extractList } from '../../types/api';
import type { PatientFlowDay } from '../../utils/patientFlow';
import { PatientFlowChart } from '../Patients/PatientFlowChart';
import { buildPatientFlow } from '../../utils/patientFlow';

/** Last 7 days of admissions/discharges, aggregated by GET /patients/flow. */
export const PatientFlowSection = () => {
  const { t, i18n } = useTranslation();
  const { data, isError, refetch } = useQuery({
    queryKey: ['patients', 'flow'],
    queryFn: async () => extractList<PatientFlowDay>(await getPatientFlow()),
    staleTime: 60_000,
  });

  const admissionsLabel = t('patients.flow.admissions');
  const dischargesLabel = t('patients.flow.discharges');
  const flow = useMemo(
    () => buildPatientFlow(data ?? [], { admissions: admissionsLabel, discharges: dischargesLabel }, i18n.language),
    [data, admissionsLabel, dischargesLabel, i18n.language],
  );

  return (
    <section aria-label={t('dashboard.patientFlowSection')} className="space-y-2">
      {isError ? (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{t('dashboard.patientFlowError')}</span>
          <button
            onClick={() => { void refetch(); }}
            className="text-sm font-semibold underline px-2"
            aria-label={t('dashboard.patientFlowRetryLabel')}
          >
            {t('common.retry')}
          </button>
        </div>
      ) : (
        <PatientFlowChart data={flow} />
      )}
    </section>
  );
};
