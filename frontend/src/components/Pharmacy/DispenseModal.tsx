// components/Pharmacy/DispenseModal.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { dispenseItem } from '../../services/pharmacyService';
import { getErrorCode, getErrorMessage } from '../../types/api';
import type { PrescriptionItem } from '../../types/clinical';

export const DispenseModal = ({ item, onClose, onDone }: { item: PrescriptionItem; onClose: () => void; onDone: () => void }) => {
  const { t } = useTranslation();
  const [qty, setQty] = useState('1');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const n = Number(qty);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await dispenseItem(item.id, n);
      onDone();
      onClose();
    } catch (err: unknown) {
      setError(getErrorCode(err) === 'INSUFFICIENT_STOCK' ? t('errors.codes.INSUFFICIENT_STOCK') : getErrorMessage(err, t('pharmacy.dispenseFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-hospital-navy/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="dispense-title">
      <form onSubmit={submit} className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 id="dispense-title" className="text-lg font-bold">{t('pharmacy.dispenseTitle', { name: item.medication.name })}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')}><X className="w-5 h-5" aria-hidden="true" /></button>
        </div>
        <p className="text-sm text-gray-600">{item.medication.strength} ({item.medication.form}) — {item.dose}, {item.frequency}</p>
        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
        <div>
          <label htmlFor="dispense-qty" className="text-sm font-medium text-gray-700">{t('pharmacy.unitsToDispense')}</label>
          <input id="dispense-qty" type="number" min={1} step={1} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={qty} onChange={(e) => setQty(e.target.value)} required />
        </div>
        <div className="flex gap-3 pt-2 border-t">
          <button type="button" onClick={onClose} className="flex-1 bg-gray-100 py-2 rounded-lg text-sm">{t('common.cancel')}</button>
          <button type="submit" disabled={saving || !Number.isInteger(n) || n < 1} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm disabled:opacity-50">{saving ? t('common.saving') : t('pharmacy.dispense')}</button>
        </div>
      </form>
    </div>
  );
};
