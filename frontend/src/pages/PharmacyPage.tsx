// pages/PharmacyPage.tsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Pill } from 'lucide-react';
import { DispenseQueue } from '../components/Pharmacy/DispenseQueue';
import { StockActionModal, type StockAction } from '../components/Pharmacy/StockActionModal';
import { useAuthPermissions } from '../hooks/useAuthPermissions';
import { getStock, pharmacyKeys } from '../services/pharmacyService';
import { formatMoney } from '../utils/money';
import type { Medication } from '../types/clinical';

export const PharmacyPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { can } = useAuthPermissions();
  const [lowOnly, setLowOnly] = useState(false);
  const [action, setAction] = useState<{ med: Medication; type: StockAction } | null>(null);
  const stock = useQuery({ queryKey: [...pharmacyKeys.stock, lowOnly], queryFn: () => getStock(lowOnly) });
  const canManage = can('pharmacy:manage');

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Pill className="w-6 h-6 text-blue-600" aria-hidden="true" />{t('pharmacy.title')}</h1>
        <p className="text-gray-500 text-sm mt-1">{t('pharmacy.subtitle')}</p>
      </div>

      {can('pharmacy:queue') && <DispenseQueue />}

      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
        {t('pharmacy.lowOnly')}
      </label>

      {stock.isError ? (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 flex justify-between">
          <span>{t('pharmacy.loadFailed')}</span>
          <button className="underline font-medium" onClick={() => stock.refetch()}>{t('audit.retry')}</button>
        </div>
      ) : stock.isPending ? (
        <div className="flex justify-center h-32 items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" role="status" aria-label={t('common.loading')} /></div>
      ) : stock.data.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">{t('pharmacy.empty')}</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-gray-600">
              <tr>
                {(['medication', 'onHand', 'reorder', 'price'] as const).map((c) => <th key={c} scope="col" className="px-4 py-3 text-start font-medium">{t(`pharmacy.cols.${c}`)}</th>)}
                {canManage && <th scope="col" className="px-4 py-3 text-start font-medium">{t('users.cols.actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stock.data.map((m) => {
                const qty = m.stockQuantity ?? 0;
                const low = qty <= (m.reorderLevel ?? 0);
                return (
                  <tr key={m.id}>
                    <td className="px-4 py-3"><div className="font-medium text-gray-900">{m.name}</div><div className="text-xs text-gray-500">{m.form} · {m.strength}</div></td>
                    <td className="px-4 py-3">
                      <span className={low ? 'text-red-700 font-semibold' : ''}>{qty}</span>
                      {low && <span className="ms-2 px-2 py-0.5 rounded-full bg-red-50 text-red-800 text-xs">{t('pharmacy.low')}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.reorderLevel ?? 0}</td>
                    <td className="px-4 py-3 text-gray-600">{formatMoney(m.unitPriceMinor ?? 0)}</td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <button className="text-blue-700 underline" onClick={() => setAction({ med: m, type: 'receive' })}>{t('pharmacy.receive')}</button>
                          <button className="text-gray-700 underline" onClick={() => setAction({ med: m, type: 'adjust' })}>{t('pharmacy.adjust')}</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {action && (
        <StockActionModal medication={action.med} action={action.type} onClose={() => setAction(null)} onSaved={() => queryClient.invalidateQueries({ queryKey: pharmacyKeys.stock })} />
      )}
    </div>
  );
};
