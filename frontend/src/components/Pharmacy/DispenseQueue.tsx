// components/Pharmacy/DispenseQueue.tsx
// Worklist of ACTIVE prescriptions. Shows the patient's name and code only; clinical records stay on the patient page.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DispenseModal } from './DispenseModal';
import { getQueue, pharmacyKeys, type QueueItem } from '../../services/pharmacyService';
import { formatDate } from '../../utils/datetime';

export const DispenseQueue = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [item, setItem] = useState<QueueItem | null>(null);
  const queue = useQuery({ queryKey: [...pharmacyKeys.queue, search], queryFn: () => getQueue(search), placeholderData: (prev) => prev });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: pharmacyKeys.queue });
    queryClient.invalidateQueries({ queryKey: pharmacyKeys.stock });
  };

  return (
    <section aria-labelledby="queue-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="queue-title" className="text-lg font-semibold text-gray-900">{t('pharmacy.queue.title')}</h2>
          <p className="text-sm text-gray-500">{t('pharmacy.queue.subtitle')}</p>
        </div>
        <input
          type="search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('pharmacy.queue.search')}
          placeholder={t('pharmacy.queue.search')} className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-full sm:w-64"
        />
      </div>
      {queue.isError ? (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 flex justify-between">
          <span>{t('pharmacy.queue.loadFailed')}</span>
          <button className="underline font-medium" onClick={() => queue.refetch()}>{t('audit.retry')}</button>
        </div>
      ) : queue.isPending ? (
        <div className="flex justify-center h-20 items-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" role="status" aria-label={t('common.loading')} /></div>
      ) : queue.data.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center bg-white rounded-xl border border-slate-200">{t('pharmacy.queue.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {queue.data.map((rx) => (
            <li key={rx.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-medium text-gray-900">{rx.patient.name} <span className="text-gray-500 font-normal">({rx.patient.patientCode})</span></span>
                <span className="text-gray-500">{t('pharmacy.queue.prescribedBy', { name: rx.prescriberName })} · {formatDate(rx.createdAt)}</span>
              </div>
              <ul className="mt-2 divide-y divide-slate-100">
                {rx.items.map((i) => (
                  <li key={i.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      <span className="font-medium">{i.medication.name}</span> {i.medication.strength} ({i.medication.form}) — {i.dose}, {i.frequency}
                      {i._count.dispensations > 0 && <span className="ms-2 text-xs text-gray-500">{t('pharmacy.queue.dispensedTimes', { count: i._count.dispensations })}</span>}
                    </span>
                    {i.medication.active
                      ? <button className="text-blue-700 underline" onClick={() => setItem(i)}>{t('pharmacy.dispense')}</button>
                      : <span className="text-xs text-red-700">{t('pharmacy.queue.retired')}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {item && <DispenseModal item={item} onClose={() => setItem(null)} onDone={refresh} />}
    </section>
  );
};
