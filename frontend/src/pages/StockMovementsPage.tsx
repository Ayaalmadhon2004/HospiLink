// pages/StockMovementsPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { getMovements, getStock, pharmacyKeys } from '../services/pharmacyService';
import { STOCK_MOVEMENT_TYPES, type StockMovementType } from '../types/clinical';
import { enumLabel } from '../utils/enumLabel';
import { formatDateTime } from '../utils/datetime';

const SELECT = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white';

export const StockMovementsPage = () => {
  const { t } = useTranslation();
  const [medicationId, setMedicationId] = useState('');
  const [type, setType] = useState<StockMovementType | ''>('');
  const [page, setPage] = useState(1);
  const meds = useQuery({ queryKey: [...pharmacyKeys.stock, false], queryFn: () => getStock(false) });
  const movements = useQuery({
    queryKey: [...pharmacyKeys.movements, medicationId, type, page],
    queryFn: () => getMovements({ medicationId, type: type || undefined, page }),
  });
  const pagination = movements.data?.pagination;
  const totalPages = Math.max(pagination?.totalPages ?? 1, 1);
  // A filter change always goes back to the first page.
  const pick = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><History className="w-6 h-6 text-blue-600" aria-hidden="true" />{t('pharmacy.movements.title')}</h1>
        <p className="text-gray-500 text-sm mt-1">{t('pharmacy.movements.subtitle')}</p>
        <Link to="/pharmacy" className="inline-block mt-2 text-sm text-blue-700 underline">{t('pharmacy.movements.back')}</Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <select aria-label={t('pharmacy.movements.filterMedication')} className={SELECT} value={medicationId} onChange={(e) => pick(setMedicationId)(e.target.value)}>
          <option value="">{t('pharmacy.movements.allMedications')}</option>
          {(meds.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name} {m.strength}</option>)}
        </select>
        <select aria-label={t('pharmacy.movements.filterType')} className={SELECT} value={type} onChange={(e) => pick(setType)(e.target.value as StockMovementType | '')}>
          <option value="">{t('pharmacy.movements.allTypes')}</option>
          {STOCK_MOVEMENT_TYPES.map((v) => <option key={v} value={v}>{enumLabel(t, 'stockMovement', v)}</option>)}
        </select>
      </div>

      {movements.isError ? (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 flex justify-between">
          <span>{t('pharmacy.movements.loadFailed')}</span>
          <button className="underline font-medium" onClick={() => movements.refetch()}>{t('audit.retry')}</button>
        </div>
      ) : movements.isPending ? (
        <div className="flex justify-center h-32 items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" role="status" aria-label={t('common.loading')} /></div>
      ) : movements.data.rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">{t('pharmacy.movements.empty')}</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-gray-600">
              <tr>{(['date', 'medication', 'type', 'change', 'note', 'by'] as const).map((c) => <th key={c} scope="col" className="px-4 py-3 text-start font-medium">{t(`pharmacy.movements.cols.${c}`)}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.data.rows.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 whitespace-nowrap"><time dateTime={m.createdAt}>{formatDateTime(m.createdAt)}</time></td>
                  <td className="px-4 py-3">{m.medication.name} <span className="text-xs text-gray-500">{m.medication.strength}</span></td>
                  <td className="px-4 py-3">{enumLabel(t, 'stockMovement', m.type)}</td>
                  <td className={`px-4 py-3 font-semibold ${m.delta < 0 ? 'text-red-700' : 'text-emerald-700'}`} dir="ltr">{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                  <td className="px-4 py-3 text-gray-600">{m.note ?? ''}</td>
                  <td className="px-4 py-3 text-gray-600">{m.userName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm">
          <button className="px-3 py-1.5 rounded-lg bg-gray-100 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('pharmacy.movements.previous')}</button>
          <span>{t('pharmacy.movements.pageOf', { page, pages: totalPages })}</span>
          <button className="px-3 py-1.5 rounded-lg bg-gray-100 disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t('pharmacy.movements.next')}</button>
        </div>
      )}
    </div>
  );
};
