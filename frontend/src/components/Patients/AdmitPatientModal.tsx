// components/Patients/AdmitPatientModal.tsx
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AdmitField, ADMIT_INPUT_CLASS } from './admit/AdmitField';
import { BedPicker } from './admit/BedPicker';
import { DEPARTMENTS, GENDERS } from './admit/admitState';
import { useAdmitPatient } from './admit/useAdmitPatient';

interface AdmitPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: () => void;
}

export const AdmitPatientModal = ({ isOpen, onClose, onAdd }: AdmitPatientModalProps) => {
  const { t } = useTranslation();
  const { state, setField, clearBed, submit } = useAdmitPatient({ isOpen, onClose, onAdd });
  const firstInputRef = useRef<HTMLInputElement>(null);
  const { formData, submitting, error, errorDetails, success } = state;

  useEffect(() => {
    if (isOpen) firstInputRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-hospital-navy/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admit-modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 id="admit-modal-title" className="text-xl font-bold text-hospital-navy">
            {t('patients.admitModal.title')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-medical-teal"
            disabled={submitting}
            aria-label={t('common.closeModal')}
            type="button"
          >
            <X size={20} className="text-clinic-text/50" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4" noValidate>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm" role="alert" aria-live="assertive">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={16} aria-hidden="true" />
                <span className="font-medium">{error}</span>
              </div>
              {errorDetails && <p className="text-xs text-red-400 ms-6">{errorDetails}</p>}
            </div>
          )}

          {success && (
            <div
              className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
              role="status"
              aria-live="polite"
            >
              <CheckCircle2 size={16} aria-hidden="true" />
              {t('patients.admitModal.success')}
            </div>
          )}

          <AdmitField id="patient-name" label={t('patients.admitModal.fullName')}>
            <input
              ref={firstInputRef}
              id="patient-name"
              type="text"
              value={formData.name}
              onChange={(event) => setField('name', event.target.value)}
              placeholder={t('patients.admitModal.namePlaceholder')}
              className={ADMIT_INPUT_CLASS}
              disabled={submitting}
              aria-required="true"
              aria-invalid={!!error && !formData.name.trim()}
              name="patient-name"
              autoComplete="off"
            />
          </AdmitField>

          <div className="grid grid-cols-2 gap-4">
            <AdmitField id="patient-age" label={t('patients.admitModal.age')}>
              <input
                id="patient-age"
                type="number"
                min="0"
                max="150"
                value={formData.age}
                onChange={(event) => setField('age', event.target.value)}
                placeholder={t('patients.admitModal.agePlaceholder')}
                className={ADMIT_INPUT_CLASS}
                disabled={submitting}
                aria-required="true"
                aria-invalid={!!error && (!formData.age || Number.isNaN(Number(formData.age)))}
              />
            </AdmitField>
            <AdmitField id="patient-gender" label={t('patients.admitModal.gender')}>
              <select
                id="patient-gender"
                value={formData.gender}
                onChange={(event) => setField('gender', event.target.value)}
                className={`${ADMIT_INPUT_CLASS} bg-white`}
                disabled={submitting}
                aria-required="true"
              >
                {GENDERS.map((gender) => (
                  <option key={gender} value={gender}>{t(`gender.${gender}`)}</option>
                ))}
              </select>
            </AdmitField>
          </div>

          <AdmitField id="patient-department" label={t('patients.admitModal.department')}>
            <select
              id="patient-department"
              value={formData.department}
              onChange={(event) => setField('department', event.target.value)}
              className={`${ADMIT_INPUT_CLASS} bg-white`}
              disabled={submitting}
              aria-required="true"
              aria-invalid={!!error && !formData.department}
            >
              <option value="">{t('patients.admitModal.selectDepartment')}</option>
              {DEPARTMENTS.map((department) => (
                <option key={department} value={department}>{t(`departments.${department}`, { defaultValue: department })}</option>
              ))}
            </select>
          </AdmitField>

          <AdmitField id="patient-diagnosis" label={t('patients.admitModal.diagnosis')}>
            <input
              id="patient-diagnosis"
              type="text"
              value={formData.diagnosis}
              onChange={(event) => setField('diagnosis', event.target.value)}
              placeholder={t('patients.admitModal.diagnosisPlaceholder')}
              className={ADMIT_INPUT_CLASS}
              disabled={submitting}
              aria-required="true"
              aria-invalid={!!error && !formData.diagnosis.trim()}
            />
          </AdmitField>

          <BedPicker state={state} onSelect={(bedId) => setField('bedId', bedId)} onClear={clearBed} />

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 text-clinic-text px-4 py-2.5 rounded-xl hover:bg-slate-200 transition font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
              disabled={submitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || success}
              className="flex-1 bg-hospital-navy text-white px-4 py-2.5 rounded-xl hover:bg-hospital-navy/90 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-hospital-navy focus:ring-offset-2"
              aria-busy={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  {t('patients.admitModal.admitting')}
                </>
              ) : (
                t('patients.admit')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
