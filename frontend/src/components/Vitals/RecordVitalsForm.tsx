import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { EMPTY_FORM, METRIC_FIELDS, toReading, type FormValues, type Reading } from '../../utils/vitalsForm';

const INPUT_CLASS = 'w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none';

interface RecordVitalsFormProps {
  submitting: boolean;
  onSubmit: (reading: Reading) => void;
  onCancel: () => void;
}

export const RecordVitalsForm = ({ submitting, onSubmit, onCancel }: RecordVitalsFormProps) => {
  const { t } = useTranslation();
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    onSubmit(toReading(values));
  };

  return (
    <div
      id="vitals-form"
      className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <h3 className="text-lg font-bold text-hospital-navy mb-4">{t('vitals.page.recordNew')}</h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {METRIC_FIELDS.map((field) => (
          <div key={field.name}>
            <label htmlFor={field.id} className="block text-sm text-clinic-text/60 mb-1">
              {t(field.labelKey)} <span className="text-xs text-clinic-text/50">{field.hint}</span>
            </label>
            <input
              id={field.id}
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              value={values[field.name]}
              onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
              className={INPUT_CLASS}
              placeholder={field.placeholder}
            />
          </div>
        ))}
        <div className="col-span-2 md:col-span-3">
          <label htmlFor="notes" className="block text-sm text-clinic-text/60 mb-1">
            {t('vitals.page.notes')}
          </label>
          <textarea
            id="notes"
            value={values.notes}
            onChange={(event) => setValues({ ...values, notes: event.target.value })}
            className={`${INPUT_CLASS} resize-none`}
            rows={2}
            placeholder={t('vitals.page.notesPlaceholder')}
          />
        </div>
        <div className="col-span-2 md:col-span-3 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-slate-100 text-clinic-text py-3 rounded-xl hover:bg-slate-200 transition font-medium"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-hospital-navy text-white py-3 rounded-xl hover:bg-hospital-navy/90 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            aria-busy={submitting}
          >
            {submitting ? t('common.saving') : t('vitals.page.save')}
          </button>
        </div>
      </form>
    </div>
  );
};
