// components/Billing/CreateInvoiceModal.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Combobox } from '../Form/Combobox';
import { apiGetAll } from '../../services/paginate';
import { createInvoice } from '../../services/billingService';
import { getErrorMessage } from '../../types/api';
import type { Patient } from '../../types/patient';

export const CreateInvoiceModal = ({ onClose, onCreated }: { onClose: () => void; onCreated: (invoiceId: string) => void }) => {
  const { t } = useTranslation();
  const [patientId, setPatientId] = useState('');
  const [includeDispensations, setInclude] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const patients = useQuery({ queryKey: ['billing', 'patients'], queryFn: async () => (await apiGetAll<Patient>('/patients')).data });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      onCreated((await createInvoice(patientId, includeDispensations)).id);
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('billing.createFailed')));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-hospital-navy/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="new-inv-title">
      <form onSubmit={submit} className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 id="new-inv-title" className="text-lg font-bold">{t('billing.new')}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')}><X className="w-5 h-5" aria-hidden="true" /></button>
        </div>
        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
        <div>
          <label htmlFor="inv-patient" className="text-sm font-medium text-gray-700">{t('billing.patient')}</label>
          <Combobox id="inv-patient" options={(patients.data ?? []).map((p) => ({ label: p.name, value: p.id, hint: p.patientCode }))} value={patientId} onChange={setPatientId} placeholder={t('billing.selectPatient')} loading={patients.isPending} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={includeDispensations} onChange={(e) => setInclude(e.target.checked)} />
          {t('billing.includeDispensations')}
        </label>
        <div className="flex gap-3 pt-2 border-t">
          <button type="button" onClick={onClose} className="flex-1 bg-gray-100 py-2 rounded-lg text-sm">{t('common.cancel')}</button>
          <button type="submit" disabled={saving || !patientId} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm disabled:opacity-50">{saving ? t('common.saving') : t('billing.create')}</button>
        </div>
      </form>
    </div>
  );
};
