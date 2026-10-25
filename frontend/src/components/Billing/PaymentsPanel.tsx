// components/Billing/PaymentsPanel.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney, parseMajorToMinor } from '../../utils/money';
import { recordPayment } from '../../services/billingService';
import { formatDateTime } from '../../utils/datetime';
import { PAYMENT_METHODS, type Invoice, type PaymentMethod } from '../../types/billing';

interface Props {
  invoice: Invoice;
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<unknown>;
}

export const PaymentsPanel = ({ invoice, busy, run }: Props) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const balance = invoice.totalMinor - invoice.paidMinor;
  const minor = parseMajorToMinor(amount);
  const money = (n: number) => formatMoney(n, invoice.currency);
  const payments = invoice.payments ?? [];
  // Mirrors the server: positive and never more than the balance.
  const valid = minor !== null && minor > 0 && minor <= balance;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    await run(() => recordPayment(invoice.id, { amountMinor: minor, method, reference: reference.trim() || undefined }));
    setAmount(''); setReference('');
  };

  return (
    <section aria-labelledby="inv-payments" className="space-y-3">
      <h2 id="inv-payments" className="text-lg font-bold text-gray-900">{t('billing.payments')}</h2>
      <p className="text-sm text-gray-600">{t('billing.paidOf', { paid: money(invoice.paidMinor), total: money(invoice.totalMinor) })} · <strong>{t('billing.balance', { amount: money(balance) })}</strong></p>
      {payments.length > 0 && (
        <ul className="text-sm divide-y divide-slate-100 bg-white rounded-xl border border-slate-200">
          {payments.map((p) => (
            <li key={p.id} className="px-4 py-2 flex flex-wrap justify-between gap-2">
              <span>{money(p.amountMinor)} · {t(`billing.methods.${p.method}`)}{p.reference ? ` · ${p.reference}` : ''}</span>
              <span className="text-gray-500">{p.receivedByName} · <time dateTime={p.createdAt}>{formatDateTime(p.createdAt)}</time></span>
            </li>
          ))}
        </ul>
      )}
      {invoice.status === 'ISSUED' && balance > 0 && (
        <form onSubmit={submit} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
          <div><label htmlFor="pay-amount" className="text-xs font-medium text-gray-600">{t('billing.amount')}</label>
            <input id="pay-amount" inputMode="decimal" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full" value={amount} onChange={(e) => setAmount(e.target.value)} required aria-invalid={amount !== '' && !valid} /></div>
          <div><label htmlFor="pay-method" className="text-xs font-medium text-gray-600">{t('billing.method')}</label>
            <select id="pay-method" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full bg-white" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(`billing.methods.${m}`)}</option>)}
            </select></div>
          <div><label htmlFor="pay-ref" className="text-xs font-medium text-gray-600">{t('billing.reference')}</label>
            <input id="pay-ref" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
          <button type="submit" disabled={busy || !valid} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">{t('billing.recordPayment')}</button>
        </form>
      )}
    </section>
  );
};
