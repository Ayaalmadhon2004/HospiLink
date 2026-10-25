import { useTranslation } from 'react-i18next';
import type { InvoiceStatus } from '../../types/billing';

const STYLE: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 ring-slate-200',
  ISSUED: 'bg-amber-50 text-amber-800 ring-amber-200',
  PAID: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  VOID: 'bg-red-50 text-red-800 ring-red-200',
};

export const InvoiceStatusBadge = ({ status }: { status: InvoiceStatus }) => {
  const { t } = useTranslation();
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${STYLE[status]}`}>{t(`billing.status.${status}`)}</span>;
};
