// pages/InvoiceDetailPage.tsx
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { InvoiceLines } from '../components/Billing/InvoiceLines';
import { PaymentsPanel } from '../components/Billing/PaymentsPanel';
import { InvoiceStatusBadge } from '../components/Billing/InvoiceStatusBadge';
import { ConfirmModal } from '../components/ConfirmModal';
import { useInvoice } from '../hooks/useInvoice';
import { issueInvoice, voidInvoice } from '../services/billingService';
import { formatDateTime } from '../utils/datetime';

export const InvoiceDetailPage = () => {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const { invoice, run, busy } = useInvoice(id);
  const [confirm, setConfirm] = useState<'issue' | 'void' | null>(null);

  if (invoice.isPending) return <div className="flex justify-center h-32 items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" role="status" aria-label={t('common.loading')} /></div>;
  if (invoice.isError) return <div role="alert" className="m-8 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{t('billing.loadFailed')}</div>;

  const inv = invoice.data;
  const canVoid = (inv.status === 'DRAFT' || inv.status === 'ISSUED') && inv.paidMinor === 0;
  const canIssue = inv.status === 'DRAFT' && (inv.lines?.length ?? 0) > 0;

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-4xl">
      <Link to="/billing" className="text-sm text-blue-700 flex items-center gap-1"><ArrowLeft className="w-4 h-4" aria-hidden="true" />{t('billing.back')}</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{inv.number ?? t('billing.draft')}</h1>
          <p className="text-sm text-gray-600">{inv.patient.name} · {inv.patient.patientCode}{inv.issuedAt && <> · <time dateTime={inv.issuedAt}>{formatDateTime(inv.issuedAt)}</time></>}</p>
        </div>
        <div className="flex items-center gap-2">
          <InvoiceStatusBadge status={inv.status} />
          {canIssue && <button disabled={busy} onClick={() => setConfirm('issue')} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">{t('billing.issue')}</button>}
          {canVoid && <button disabled={busy} onClick={() => setConfirm('void')} className="bg-red-50 text-red-700 px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">{t('billing.void')}</button>}
        </div>
      </div>

      <InvoiceLines invoice={inv} busy={busy} run={run} />
      {inv.status !== 'DRAFT' && <PaymentsPanel invoice={inv} busy={busy} run={run} />}

      <ConfirmModal
        isOpen={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={async () => { await run(() => (confirm === 'issue' ? issueInvoice(id) : voidInvoice(id))); }}
        title={t(confirm === 'issue' ? 'billing.confirmIssueTitle' : 'billing.confirmVoidTitle')}
        message={t(confirm === 'issue' ? 'billing.confirmIssue' : 'billing.confirmVoid')}
        tone={confirm === 'issue' ? 'primary' : 'danger'}
      />
    </div>
  );
};
