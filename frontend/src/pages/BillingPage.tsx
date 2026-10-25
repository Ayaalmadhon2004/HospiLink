// pages/BillingPage.tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Receipt } from 'lucide-react';
import { CreateInvoiceModal } from '../components/Billing/CreateInvoiceModal';
import { InvoiceStatusBadge } from '../components/Billing/InvoiceStatusBadge';
import { billingKeys, getInvoices } from '../services/billingService';
import { formatMoney } from '../utils/money';
import { formatDate } from '../utils/datetime';
import type { InvoiceStatus } from '../types/billing';

type Filter = 'ALL' | InvoiceStatus;
const FILTERS: Filter[] = ['ALL', 'DRAFT', 'ISSUED', 'PAID', 'VOID'];

export const BillingPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [creating, setCreating] = useState(false);
  const invoices = useQuery({ queryKey: [...billingKeys.list, filter], queryFn: () => getInvoices(filter === 'ALL' ? undefined : filter) });

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Receipt className="w-6 h-6 text-blue-600" aria-hidden="true" />{t('billing.title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('billing.subtitle')}</p>
        </div>
        <button onClick={() => setCreating(true)} className="bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium">{t('billing.new')}</button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('billing.filter')}>
        {FILTERS.map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${filter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}>
            {f === 'ALL' ? t('users.filters.ALL') : t(`billing.status.${f}`)}
          </button>
        ))}
      </div>

      {invoices.isError ? (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 flex justify-between">
          <span>{t('billing.loadFailed')}</span><button className="underline font-medium" onClick={() => invoices.refetch()}>{t('audit.retry')}</button>
        </div>
      ) : invoices.isPending ? (
        <div className="flex justify-center h-32 items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" role="status" aria-label={t('common.loading')} /></div>
      ) : invoices.data.items.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">{t('billing.empty')}</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-gray-600"><tr>
              {(['number', 'patient', 'status', 'total', 'paid', 'date'] as const).map((c) => <th key={c} scope="col" className="px-4 py-3 text-start font-medium">{t(`billing.cols.${c}`)}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.data.items.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3"><Link className="text-blue-700 underline" to={`/billing/${inv.id}`}>{inv.number ?? t('billing.draft')}</Link></td>
                  <td className="px-4 py-3">{inv.patient.name}</td>
                  <td className="px-4 py-3"><InvoiceStatusBadge status={inv.status} /></td>
                  <td className="px-4 py-3">{formatMoney(inv.totalMinor, inv.currency)}</td>
                  <td className="px-4 py-3">{formatMoney(inv.paidMinor, inv.currency)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(inv.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <CreateInvoiceModal onClose={() => setCreating(false)} onCreated={(id) => navigate(`/billing/${id}`)} />}
    </div>
  );
};
