// components/Clinical/PrescriptionsTab.tsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PrescriptionModal } from './PrescriptionModal';
import { MedicationCatalogModal } from './MedicationCatalogModal';
import { DispenseModal } from '../Pharmacy/DispenseModal';
import { useAuthPermissions } from '../../hooks/useAuthPermissions';
import { clinicalKeys, getPrescriptions, closePrescription } from '../../services/clinicalService';
import { getErrorMessage } from '../../types/api';
import { formatDateTime } from '../../utils/datetime';
import type { PrescriptionItem } from '../../types/clinical';

const STATUS_STYLE = {
  ACTIVE: 'bg-emerald-50 text-emerald-800',
  COMPLETED: 'bg-slate-100 text-slate-700',
  CANCELLED: 'bg-red-50 text-red-800',
} as const;

export const PrescriptionsTab = ({ patientId }: { patientId: string }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { can } = useAuthPermissions();
  const [creating, setCreating] = useState(false);
  const [catalog, setCatalog] = useState(false);
  const [dispensing, setDispensing] = useState<PrescriptionItem | null>(null);
  const { data: list = [], isPending } = useQuery({ queryKey: clinicalKeys.prescriptions(patientId), queryFn: () => getPrescriptions(patientId) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: clinicalKeys.prescriptions(patientId) });

  const close = async (id: string, status: 'COMPLETED' | 'CANCELLED') => {
    try {
      await closePrescription(id, status);
      await refresh();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t('clinical.rx.closeFailed')));
      await refresh();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {can('rx:write') && <button onClick={() => setCreating(true)} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium">{t('clinical.rx.add')}</button>}
        {can('medications:manage') && <button onClick={() => setCatalog(true)} className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg text-sm font-medium">{t('clinical.medications.manage')}</button>}
      </div>
      {isPending ? <p className="text-sm text-gray-500">{t('common.loading')}</p> : list.length === 0 ? (
        <p className="text-sm text-gray-500">{t('clinical.rx.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {list.map((rx) => (
            <li key={rx.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[rx.status]}`}>{t(`clinical.rx.status.${rx.status}`)}</span>
                <span className="font-medium">{rx.prescriberName}</span>
                <time dateTime={rx.createdAt}>{formatDateTime(rx.createdAt)}</time>
              </div>
              <ul className="mt-2 text-sm space-y-1">
                {rx.items.map((i) => (
                  <li key={i.id}>
                    <span className="font-medium">{i.medication.name} {i.medication.strength}</span> ({i.medication.form}) — {i.dose}, {i.frequency}
                    {i.route && `, ${i.route}`}{i.durationDays && `, ${t('clinical.rx.forDays', { count: i.durationDays })}`}
                    {i.instructions && <span className="text-gray-500"> · {i.instructions}</span>}
                    {rx.status === 'ACTIVE' && can('pharmacy:dispense') && (
                      <button className="ms-2 text-blue-700 underline" onClick={() => setDispensing(i)}>{t('pharmacy.dispense')}</button>
                    )}
                  </li>
                ))}
              </ul>
              {rx.notes && <p className="mt-1 text-xs text-gray-500">{rx.notes}</p>}
              {rx.status === 'ACTIVE' && can('rx:write') && (
                <div className="mt-2 flex gap-3 text-sm">
                  <button className="text-blue-700 underline" onClick={() => close(rx.id, 'COMPLETED')}>{t('clinical.rx.complete')}</button>
                  <button className="text-red-700 underline" onClick={() => close(rx.id, 'CANCELLED')}>{t('clinical.rx.cancel')}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {creating && <PrescriptionModal patientId={patientId} onClose={() => setCreating(false)} onSaved={refresh} />}
      {catalog && <MedicationCatalogModal onClose={() => setCatalog(false)} />}
      {dispensing && <DispenseModal item={dispensing} onClose={() => setDispensing(null)} onDone={() => queryClient.invalidateQueries({ queryKey: ['pharmacy'] })} />}
    </div>
  );
};
