import { ChevronDown, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Patient } from '../../types/patient';

interface PatientSelectorProps {
  patients: readonly Pick<Patient, 'id' | 'name' | 'patientCode' | 'department'>[];
  selectedId: string;
  onSelect: (id: string) => void;
  formOpen: boolean;
  onToggleForm: () => void;
}

export const PatientSelector = ({ patients, selectedId, onSelect, formOpen, onToggleForm }: PatientSelectorProps) => {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
        <div className="relative flex-1">
          <label htmlFor="patient-select" className="sr-only">
            {t('vitals.page.selectPatient')}
          </label>
          <select
            id="patient-select"
            value={selectedId}
            onChange={(event) => onSelect(event.target.value)}
            className="w-full appearance-none border border-slate-200 p-3 pe-10 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none bg-white"
          >
            <option value="">{t('vitals.page.selectPatient')}</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name} • {patient.patientCode} • {t(`departments.${patient.department}`, { defaultValue: patient.department })}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-clinic-text/70 pointer-events-none"
            aria-hidden="true"
          />
        </div>

        {selectedId && (
          <button
            onClick={onToggleForm}
            className="bg-hospital-navy text-white px-6 py-3 rounded-xl hover:bg-hospital-navy/90 transition flex items-center justify-center gap-2 shadow-sm"
            aria-expanded={formOpen}
            aria-controls="vitals-form"
          >
            <Plus size={18} aria-hidden="true" />
            {formOpen ? t('vitals.page.hideForm') : t('vitals.page.recordVitals')}
          </button>
        )}
      </div>
    </div>
  );
};
