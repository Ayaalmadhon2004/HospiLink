// components/Pharmacy/StockActionModal.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { receiveStock, adjustStock } from '../../services/pharmacyService';
import { getErrorCode, getErrorMessage } from '../../types/api';
import type { Medication } from '../../types/clinical';

export type StockAction = 'receive' | 'adjust';
const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';

export const StockActionModal = ({ medication, action, onClose, onSaved }: { medication: Medication; action: StockAction; onClose: () => void; onSaved: () => void }) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const n = Number(amount);
  // receive: a positive whole number; adjust: any non-zero whole number (negative removes stock) plus a reason
  const valid = Number.isInteger(n) && n !== 0 && (action === 'adjust' ? note.trim().length >= 3 : n > 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (action === 'receive') await receiveStock(medication.id, n, note.trim() || undefined);
      else await adjustStock(medication.id, n, note.trim());
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(getErrorCode(err) === 'INSUFFICIENT_STOCK' ? t('errors.codes.INSUFFICIENT_STOCK') : getErrorMessage(err, t('pharmacy.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-hospital-navy/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="stock-modal-title">
      <form onSubmit={submit} className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 id="stock-modal-title" className="text-lg font-bold">{t(`pharmacy.${action}Title`, { name: medication.name })}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')}><X className="w-5 h-5" aria-hidden="true" /></button>
        </div>
        <p className="text-sm text-gray-500">{t('pharmacy.onHand', { qty: medication.stockQuantity ?? 0 })}</p>
        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
        <div>
          <label htmlFor="stock-amount" className="text-sm font-medium text-gray-700">{t(action === 'receive' ? 'pharmacy.quantity' : 'pharmacy.change')}</label>
          <input id="stock-amount" type="number" step={1} className={INPUT} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          {action === 'adjust' && <p className="text-xs text-gray-500 mt-1">{t('pharmacy.changeHint')}</p>}
        </div>
        <div>
          <label htmlFor="stock-note" className="text-sm font-medium text-gray-700">{t(action === 'receive' ? 'pharmacy.noteOptional' : 'pharmacy.reason')}</label>
          <input id="stock-note" className={INPUT} value={note} onChange={(e) => setNote(e.target.value)} required={action === 'adjust'} />
        </div>
        <div className="flex gap-3 pt-2 border-t">
          <button type="button" onClick={onClose} className="flex-1 bg-gray-100 py-2 rounded-lg text-sm">{t('common.cancel')}</button>
          <button type="submit" disabled={saving || !valid} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm disabled:opacity-50">{saving ? t('common.saving') : t('pharmacy.save')}</button>
        </div>
      </form>
    </div>
  );
};
