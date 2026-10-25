import { ExportMenu } from '../components/Export/ExportMenu';
// pages/VitalsMonitorPage.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '../types/api';
import type { RecordVitalsInput } from '../types/vitals';
import { VitalsCard } from '../components/Vitals/VitalsCard';
import { AlertsPanel } from '../components/Vitals/AlertsPanel';
import { PatientSelector } from '../components/Vitals/PatientSelector';
import { RecordVitalsForm } from '../components/Vitals/RecordVitalsForm';
import { VitalsCharts } from '../components/Vitals/VitalsCharts';
import { useVitalsMonitor } from '../hooks/useVitalsMonitor';

export const VitalsMonitorPage = () => {
  const { t } = useTranslation();
  const [selectedPatient, setSelectedPatient] = useState('');
  const [showForm, setShowForm] = useState(false);
  const { patients, patientsLoading, alerts, history, refreshing, refresh, record } = useVitalsMonitor(selectedPatient);

  const latest = history[0];

  const handleRefresh = async (): Promise<void> => {
    if (!(await refresh())) toast.error(t('vitals.page.patientsError'));
  };

  const handleSubmit = (reading: Omit<RecordVitalsInput, 'patientId'>): void => {
    record.mutate(
      { patientId: selectedPatient, ...reading },
      {
        onSuccess: () => {
          setShowForm(false);
          toast.success(t('vitals.page.recorded'));
        },
        onError: (err: unknown) => toast.error(getErrorMessage(err, '') || t('vitals.page.recordError')),
      },
    );
  };

  if (patientsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-clinic-bg">
        <div className="animate-pulse text-clinic-text/50">{t('vitals.page.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-clinic-bg p-6 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-hospital-navy flex items-center gap-2">
            <Activity size={28} className="text-medical-teal" aria-hidden="true" />
            {t('vitals.page.title')}
          </h1>
          <p className="text-clinic-text/50 text-sm">{t('vitals.page.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu type="vitals" />
          <button
            onClick={() => void handleRefresh()}
            className="flex items-center gap-2 bg-white text-clinic-text px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition shadow-sm"
            disabled={refreshing}
            aria-label={t('vitals.page.refreshLabel')}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
            {t('staff.refresh')}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <AlertsPanel alerts={alerts} />
      </div>

      <PatientSelector
        patients={patients}
        selectedId={selectedPatient}
        onSelect={setSelectedPatient}
        formOpen={showForm}
        onToggleForm={() => setShowForm((open) => !open)}
      />

      {showForm && selectedPatient && (
        <RecordVitalsForm submitting={record.isPending} onSubmit={handleSubmit} onCancel={() => setShowForm(false)} />
      )}

      {latest && (
        <div className="mb-6">
          <VitalsCard
            heartRate={latest.heartRate}
            systolicBP={latest.systolicBP}
            diastolicBP={latest.diastolicBP}
            spO2={latest.spO2}
            temperature={latest.temperature}
            respiratoryRate={latest.respiratoryRate}
            recordedAt={latest.recordedAt}
            isCritical={latest.isCritical}
          />
        </div>
      )}

      {selectedPatient && history.length === 0 && !showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center mb-6">
          <Activity size={48} className="text-clinic-text/20 mx-auto mb-3" aria-hidden="true" />
          <div className="text-clinic-text/50 font-medium">{t('vitals.page.empty')}</div>
          <button onClick={() => setShowForm(true)} className="mt-3 text-medical-teal hover:underline text-sm">
            {t('vitals.page.recordFirst')}
          </button>
        </div>
      )}

      {history.length > 1 && <VitalsCharts history={history} />}
    </div>
  );
};
