// components/Clinical/ClinicalRecords.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList } from 'lucide-react';
import { NotesTab } from './NotesTab';
import { PrescriptionsTab } from './PrescriptionsTab';
import { LabsTab } from './LabsTab';

const TABS = ['notes', 'prescriptions', 'labs'] as const;
type Tab = (typeof TABS)[number];

/** Notes, prescriptions and lab results of one patient (mounted on the patient page for ADMIN / DOCTOR / NURSE). */
export const ClinicalRecords = ({ patientId }: { patientId: string }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('notes');

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6" aria-labelledby="clinical-title">
      <h2 id="clinical-title" className="text-lg font-bold text-hospital-navy mb-4 flex items-center gap-2">
        <ClipboardList size={20} className="text-medical-teal" aria-hidden="true" />
        {t('clinical.title')}
      </h2>
      <div role="tablist" aria-label={t('clinical.title')} className="flex gap-2 mb-4 border-b border-slate-200">
        {TABS.map((id) => (
          <button
            key={id}
            role="tab"
            id={`clinical-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="clinical-panel"
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600'}`}
          >
            {t(`clinical.tabs.${id}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="clinical-panel" aria-labelledby={`clinical-tab-${tab}`}>
        {tab === 'notes' && <NotesTab patientId={patientId} />}
        {tab === 'prescriptions' && <PrescriptionsTab patientId={patientId} />}
        {tab === 'labs' && <LabsTab patientId={patientId} />}
      </div>
    </section>
  );
};
