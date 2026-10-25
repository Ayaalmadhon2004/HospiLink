// components/Clinical/PrescriptionModal.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, X } from 'lucide-react';
import { clinicalKeys, getMedications, createPrescription } from '../../services/clinicalService';
import { getErrorMessage } from '../../types/api';

interface Row { medicationId: string; dose: string; frequency: string; route: string; durationDays: string; instructions: string }
const EMPTY: Row = { medicationId: '', dose: '', frequency: '', route: '', durationDays: '', instructions: '' };
const INPUT = 'w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm';

export const PrescriptionModal = ({ patientId, onClose, onSaved }: { patientId: string; onClose: () => void; onSaved: () => void }) => {
  const { t } = useTranslation();
  const { data: meds = [] } = useQuery({ queryKey: [...clinicalKeys.medications, 'active'], queryFn: () => getMedications(true) });
  const [rows, setRows] = useState<Row[]>([EMPTY]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const valid = rows.every((r) => r.medicationId && r.dose.trim() && r.frequency.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createPrescription({
        patientId,
        notes: notes.trim() || undefined,
        items: rows.map((r) => ({
          medicationId: r.medicationId, dose: r.dose.trim(), frequency: r.frequency.trim(),
          route: r.route.trim() || undefined, instructions: r.instructions.trim() || undefined,
          durationDays: r.durationDays ? Number(r.durationDays) : undefined,
        })),
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('clinical.rx.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-hospital-navy/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="rx-title">
      <form onSubmit={submit} className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <h3 id="rx-title" className="text-lg font-bold">{t('clinical.rx.add')}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')}><X className="w-5 h-5" aria-hidden="true" /></button>
        </div>
        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
        {rows.map((r, i) => (
          <fieldset key={i} className="border border-slate-200 rounded-lg p-3 grid grid-cols-2 gap-2">
            <legend className="px-1 text-xs text-gray-500">{t('clinical.rx.item', { n: i + 1 })}</legend>
            <div className="col-span-2">
              <label htmlFor={`rx-med-${i}`} className="text-xs font-medium text-gray-600">{t('clinical.rx.medication')}</label>
              <select id={`rx-med-${i}`} className={INPUT} value={r.medicationId} onChange={(e) => set(i, { medicationId: e.target.value })} required>
                <option value="">{t('forms.select')}</option>
                {meds.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.form} · {m.strength}</option>)}
              </select>
            </div>
            <div><label htmlFor={`rx-dose-${i}`} className="text-xs font-medium text-gray-600">{t('clinical.rx.dose')}</label>
              <input id={`rx-dose-${i}`} className={INPUT} value={r.dose} onChange={(e) => set(i, { dose: e.target.value })} required /></div>
            <div><label htmlFor={`rx-freq-${i}`} className="text-xs font-medium text-gray-600">{t('clinical.rx.frequency')}</label>
              <input id={`rx-freq-${i}`} className={INPUT} value={r.frequency} onChange={(e) => set(i, { frequency: e.target.value })} required /></div>
            <div><label htmlFor={`rx-route-${i}`} className="text-xs font-medium text-gray-600">{t('clinical.rx.route')}</label>
              <input id={`rx-route-${i}`} className={INPUT} value={r.route} onChange={(e) => set(i, { route: e.target.value })} /></div>
            <div><label htmlFor={`rx-days-${i}`} className="text-xs font-medium text-gray-600">{t('clinical.rx.days')}</label>
              <input id={`rx-days-${i}`} type="number" min={1} className={INPUT} value={r.durationDays} onChange={(e) => set(i, { durationDays: e.target.value })} /></div>
            <div className="col-span-2"><label htmlFor={`rx-ins-${i}`} className="text-xs font-medium text-gray-600">{t('clinical.rx.instructions')}</label>
              <input id={`rx-ins-${i}`} className={INPUT} value={r.instructions} onChange={(e) => set(i, { instructions: e.target.value })} /></div>
            {rows.length > 1 && (
              <button type="button" className="col-span-2 justify-self-end text-red-700 text-sm flex items-center gap-1" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}>
                <Trash2 className="w-4 h-4" aria-hidden="true" />{t('clinical.rx.removeItem')}
              </button>
            )}
          </fieldset>
        ))}
        <button type="button" onClick={() => setRows((rs) => [...rs, EMPTY])} className="text-blue-700 text-sm flex items-center gap-1"><Plus className="w-4 h-4" aria-hidden="true" />{t('clinical.rx.addItem')}</button>
        <div><label htmlFor="rx-notes" className="text-xs font-medium text-gray-600">{t('clinical.rx.notes')}</label>
          <textarea id="rx-notes" rows={2} className={INPUT} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="flex gap-3 pt-2 border-t">
          <button type="button" onClick={onClose} className="flex-1 bg-gray-100 py-2 rounded-lg text-sm">{t('common.cancel')}</button>
          <button type="submit" disabled={saving || !valid} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm disabled:opacity-50">{saving ? t('common.saving') : t('clinical.rx.save')}</button>
        </div>
      </form>
    </div>
  );
};
