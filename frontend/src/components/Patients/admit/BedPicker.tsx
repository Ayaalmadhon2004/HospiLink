import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Bed, Loader2 } from 'lucide-react';
import { groupBedsByWard, type AdmitState } from './admitState';

interface BedPickerProps {
  state: AdmitState;
  onSelect: (bedId: string) => void;
  onClear: () => void;
}

/** Radio list of the free beds, grouped by ward. */
export const BedPicker = ({ state, onSelect, onClear }: BedPickerProps) => {
  const { t } = useTranslation();
  const { availableBeds, bedsLoading, bedsError, submitting, formData } = state;
  const generalWard = t('patients.admitModal.generalWard');
  const bedsByWard = useMemo(() => groupBedsByWard(availableBeds, generalWard), [availableBeds, generalWard]);

  return (
    <fieldset>
      <legend className="block text-sm font-medium text-clinic-text mb-2 flex items-center gap-2">
        <Bed size={16} className="text-medical-teal" aria-hidden="true" />
        {t('patients.admitModal.assignBed')}
      </legend>

      {bedsLoading ? (
        <div className="flex items-center gap-2 text-sm text-clinic-text/70 py-3" role="status">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          {t('patients.admitModal.loadingBeds')}
        </div>
      ) : bedsError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {bedsError}
        </div>
      ) : availableBeds.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-clinic-text/70">
          {formData.department ? t('patients.admitModal.noBedsForDepartment') : t('patients.admitModal.noBeds')}
        </div>
      ) : (
        <div
          className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto"
          role="radiogroup"
          aria-label={t('patients.admitModal.availableBeds')}
        >
          {Object.entries(bedsByWard).map(([wardName, beds]) => (
            <div key={wardName}>
              <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-clinic-text/70 uppercase tracking-wide">{wardName}</div>
              <div className="divide-y divide-slate-100">
                {beds.map((bed) => (
                  <label
                    key={bed.id}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition ${
                      formData.bedId === bed.id ? 'bg-medical-teal/5' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="bedId"
                      value={bed.id}
                      checked={formData.bedId === bed.id}
                      onChange={(event) => onSelect(event.target.value)}
                      className="w-4 h-4 text-medical-teal focus:ring-medical-teal"
                      disabled={submitting}
                      aria-label={t('patients.admitModal.bedInWard', { bed: bed.bedNumber, ward: wardName })}
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-clinic-text">{t('patients.admitModal.bed', { bed: bed.bedNumber })}</span>
                      <span className="text-xs text-green-600 ms-2 bg-green-50 px-2 py-0.5 rounded-full">
                        {t('patients.admitModal.available')}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {formData.bedId && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-clinic-text/70 hover:text-red-500 mt-1 transition focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-1"
        >
          {t('patients.admitModal.clearSelection')}
        </button>
      )}
    </fieldset>
  );
};
