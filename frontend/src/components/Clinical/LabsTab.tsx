// components/Clinical/LabsTab.tsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FormModal } from '../Form';
import { LabResultsModal } from './LabResultsModal';
import { useAuthPermissions } from '../../hooks/useAuthPermissions';
import { labOrderFields, type LabOrderFormValues } from '../../configs/entityConfigs';
import { clinicalKeys, getLabOrders, createLabOrder, cancelLabOrder } from '../../services/clinicalService';
import { getErrorMessage } from '../../types/api';
import { formatDateTime } from '../../utils/datetime';
import type { LabFlag, LabOrder } from '../../types/clinical';

const FLAG_STYLE: Record<LabFlag, string> = {
  NORMAL: 'text-emerald-700',
  LOW: 'text-amber-700 font-semibold',
  HIGH: 'text-amber-700 font-semibold',
  CRITICAL_LOW: 'text-red-700 font-bold',
  CRITICAL_HIGH: 'text-red-700 font-bold',
};

export const LabsTab = ({ patientId }: { patientId: string }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { can } = useAuthPermissions();
  const [ordering, setOrdering] = useState(false);
  const [entering, setEntering] = useState<LabOrder | null>(null);
  const { data: orders = [], isPending } = useQuery({ queryKey: clinicalKeys.labs(patientId), queryFn: () => getLabOrders(patientId) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: clinicalKeys.labs(patientId) });

  const cancel = async (id: string) => {
    try {
      await cancelLabOrder(id);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t('clinical.labs.cancelFailed')));
    }
    await refresh();
  };

  return (
    <div className="space-y-3">
      {can('labs:order') && <button onClick={() => setOrdering(true)} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium">{t('clinical.labs.order')}</button>}
      {isPending ? <p className="text-sm text-gray-500">{t('common.loading')}</p> : orders.length === 0 ? (
        <p className="text-sm text-gray-500">{t('clinical.labs.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                <span className="font-semibold text-sm text-gray-900">{o.testName}</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100">{t(`clinical.labs.status.${o.status}`)}</span>
                {o.priority !== 'ROUTINE' && <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-800">{t(`clinical.priority.${o.priority}`)}</span>}
                <span>{o.orderedByName}</span>
                <time dateTime={o.orderedAt}>{formatDateTime(o.orderedAt)}</time>
              </div>
              {o.results.length > 0 && (
                <table className="mt-2 w-full text-sm">
                  <thead><tr className="text-start text-xs text-gray-500">
                    <th scope="col" className="text-start">{t('clinical.labs.fields.analyte')}</th>
                    <th scope="col" className="text-start">{t('clinical.labs.fields.value')}</th>
                    <th scope="col" className="text-start">{t('clinical.labs.reference')}</th>
                    <th scope="col" className="text-start">{t('clinical.labs.flag')}</th>
                  </tr></thead>
                  <tbody>
                    {o.results.map((r) => (
                      <tr key={r.id}>
                        <td>{r.analyte}</td>
                        <td>{r.value ?? r.textValue} {r.unit}</td>
                        <td className="text-gray-500">{r.refLow ?? '…'} – {r.refHigh ?? '…'}</td>
                        <td className={r.flag ? FLAG_STYLE[r.flag] : ''}>{r.flag ? t(`clinical.labs.flags.${r.flag}`) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {o.status === 'ORDERED' && (
                <div className="mt-2 flex gap-3 text-sm">
                  {can('labs:result') && <button className="text-blue-700 underline" onClick={() => setEntering(o)}>{t('clinical.labs.enter')}</button>}
                  {can('labs:order') && <button className="text-red-700 underline" onClick={() => cancel(o.id)}>{t('clinical.labs.cancel')}</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {ordering && (
        <FormModal<LabOrderFormValues>
          isOpen
          onClose={() => setOrdering(false)}
          title={t('clinical.labs.order')}
          fields={labOrderFields}
          initialValues={{ priority: 'ROUTINE' }}
          onSubmit={async (v) => { await createLabOrder({ patientId, ...v }); await refresh(); }}
          submitLabel={t('clinical.labs.order')}
          submittingLabel={t('common.saving')}
        />
      )}
      {entering && <LabResultsModal order={entering} onClose={() => setEntering(null)} onSaved={refresh} />}
    </div>
  );
};
