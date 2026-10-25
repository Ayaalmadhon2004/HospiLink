// components/Clinical/LabResultsModal.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { submitLabResults } from '../../services/clinicalService';
import { getErrorMessage } from '../../types/api';
import type { LabOrder, LabResultDraft } from '../../types/clinical';

const EMPTY: LabResultDraft = { analyte: '', value: '', unit: '', refLow: '', refHigh: '', criticalLow: '', criticalHigh: '' };
const INPUT = 'w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm';
const FIELDS = ['analyte', 'value', 'unit', 'refLow', 'refHigh', 'criticalLow', 'criticalHigh'] as const;

export const LabResultsModal = ({ order, onClose, onSaved }: { order: LabOrder; onClose: () => void; onSaved: () => void }) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<LabResultDraft[]>([{ ...EMPTY, analyte: order.testName }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (i: number, patch: Partial<LabResultDraft>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await submitLabResults(order.id, rows);
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('clinical.labs.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-hospital-navy/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="lab-results-title">
      <form onSubmit={submit} className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <h3 id="lab-results-title" className="text-lg font-bold">{t('clinical.labs.enterResults', { test: order.testName })}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')}><X className="w-5 h-5" aria-hidden="true" /></button>
        </div>
        <p className="text-xs text-gray-500">{t('clinical.labs.flagHint')}</p>
        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
        {rows.map((r, i) => (
          <fieldset key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 border border-slate-200 rounded-lg p-3">
            <legend className="px-1 text-xs text-gray-500">{t('clinical.labs.analyteN', { n: i + 1 })}</legend>
            {FIELDS.map((f) => (
              <div key={f} className={f === 'analyte' ? 'col-span-2' : ''}>
                <label htmlFor={`lr-${f}-${i}`} className="text-xs font-medium text-gray-600">{t(`clinical.labs.fields.${f}`)}</label>
                <input id={`lr-${f}-${i}`} className={INPUT} value={r[f]} onChange={(e) => set(i, { [f]: e.target.value })} required={f === 'analyte' || f === 'value'} />
              </div>
            ))}
          </fieldset>
        ))}
        <button type="button" onClick={() => setRows((rs) => [...rs, EMPTY])} className="text-blue-700 text-sm flex items-center gap-1"><Plus className="w-4 h-4" aria-hidden="true" />{t('clinical.labs.addAnalyte')}</button>
        <div className="flex gap-3 pt-2 border-t">
          <button type="button" onClick={onClose} className="flex-1 bg-gray-100 py-2 rounded-lg text-sm">{t('common.cancel')}</button>
          <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm disabled:opacity-50">{saving ? t('common.saving') : t('clinical.labs.saveResults')}</button>
        </div>
      </form>
    </div>
  );
};
