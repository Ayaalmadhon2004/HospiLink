import { useTranslation, Trans } from 'react-i18next';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { Combobox } from '../Form/Combobox';
import type { AppointmentPatient } from '../../hooks/useAppointmentForm';

interface Props {
  patients: AppointmentPatient[];
  selectedPatient: AppointmentPatient | null;
  patientSearch: string;
  fetchingPatients: boolean;
  onSelect: (patient: AppointmentPatient) => void;
  onInputChange: (value: string) => void;
  onClear: () => void;
}

export const AppointmentPatientPicker = ({
  patients, selectedPatient, patientSearch, fetchingPatients, onSelect, onInputChange, onClear,
}: Props) => {
  const { t } = useTranslation();
  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {t('appointments.modal.patient')} *
      </label>
      <Combobox
        options={patients.map((p) => ({ label: p.name, value: p.id, hint: p.patientCode }))}
        value={selectedPatient?.id ?? ''}
        onChange={(id) => {
          const patient = patients.find((p) => p.id === id);
          if (patient) onSelect(patient);
        }}
        query={patientSearch}
        onQueryChange={onInputChange}
        loading={fetchingPatients}
        emptyMessage={
          patientSearch.length >= 2 && !selectedPatient ? t('appointments.modal.noPatientFound') : undefined
        }
        placeholder={t('appointments.modal.patientPlaceholder')}
      />

      {/* Selected Patient Badge */}
      {selectedPatient && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm text-gray-600">
            <Trans i18nKey="appointments.modal.selected" values={{ name: selectedPatient.name }} components={{ strong: <strong /> }} />
          </span>
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-red-500 hover:text-red-700"
          >
            {t('appointments.modal.change')}
          </button>
        </div>
      )}

      {/* Unknown patient: point at the real admit flow instead of inventing a record */}
      {!selectedPatient && patientSearch.length >= 2 && patients.length === 0 && !fetchingPatients && (
        <p className="mt-1 text-xs text-amber-700">
          <UserPlus size={12} className="inline me-1" aria-hidden="true" />
          {t('appointments.modal.noPatientFound')}{' '}
          <Link to="/patients" className="underline font-medium">{t('appointments.modal.admitPatientLink')}</Link>
        </p>
      )}
    </div>
  );
};
