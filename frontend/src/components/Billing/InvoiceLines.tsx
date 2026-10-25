// components/Billing/InvoiceLines.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { formatMoney, parseMajorToMinor } from '../../utils/money';
import { addInvoiceLine, removeInvoiceLine, setInvoiceDiscount } from '../../services/billingService';
import type { Invoice } from '../../types/billing';

interface Props {
  invoice: Invoice;
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<unknown>;
}

const INPUT = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full';

export const InvoiceLines = ({ invoice, busy, run }: Props) => {
  const { t } = useTranslation();
  const editable = invoice.status === 'DRAFT';
  const lines = invoice.lines ?? [];
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const unit = parseMajorToMinor(price);
  const discountMinor = parseMajorToMinor(discount);
  const money = (n: number) => formatMoney(n, invoice.currency);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (unit === null) return;
    await run(() => addInvoiceLine(invoice.id, { description: desc.trim(), quantity: Number(qty), unitPriceMinor: unit }));
    setDesc(''); setQty('1'); setPrice('');
  };

  return (
    <section aria-labelledby="inv-lines" className="space-y-3">
      <h2 id="inv-lines" className="text-lg font-bold text-gray-900">{t('billing.lines')}</h2>
      {lines.length === 0 ? <p className="text-sm text-gray-500">{t('billing.noLines')}</p> : (
        <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-gray-600"><tr>
              {(['description', 'quantity', 'unitPrice', 'total'] as const).map((c) => <th key={c} scope="col" className="px-4 py-2 text-start font-medium">{t(`billing.cols.${c}`)}</th>)}
              {editable && <th scope="col" className="px-4 py-2"><span className="sr-only">{t('users.cols.actions')}</span></th>}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2">{l.description}</td><td className="px-4 py-2">{l.quantity}</td>
                  <td className="px-4 py-2">{money(l.unitPriceMinor)}</td><td className="px-4 py-2">{money(l.totalMinor)}</td>
                  {editable && (
                    <td className="px-4 py-2 text-end">
                      <button disabled={busy} aria-label={t('billing.removeLine', { name: l.description })} onClick={() => run(() => removeInvoiceLine(invoice.id, l.id))} className="text-red-700 disabled:opacity-50">
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <dl className="ms-auto max-w-xs text-sm space-y-1">
        <div className="flex justify-between"><dt>{t('billing.subtotal')}</dt><dd>{money(invoice.totalMinor + invoice.discountMinor)}</dd></div>
        <div className="flex justify-between"><dt>{t('billing.discount')}</dt><dd>−{money(invoice.discountMinor)}</dd></div>
        <div className="flex justify-between font-bold text-base border-t pt-1"><dt>{t('billing.total')}</dt><dd>{money(invoice.totalMinor)}</dd></div>
      </dl>

      {editable && (
        <>
          <form onSubmit={add} className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
            <div className="col-span-2 sm:col-span-1"><label htmlFor="line-desc" className="text-xs font-medium text-gray-600">{t('billing.cols.description')}</label>
              <input id="line-desc" className={INPUT} value={desc} onChange={(e) => setDesc(e.target.value)} required /></div>
            <div><label htmlFor="line-qty" className="text-xs font-medium text-gray-600">{t('billing.cols.quantity')}</label>
              <input id="line-qty" type="number" min={1} step={1} className={INPUT} value={qty} onChange={(e) => setQty(e.target.value)} required /></div>
            <div><label htmlFor="line-price" className="text-xs font-medium text-gray-600">{t('billing.cols.unitPrice')}</label>
              <input id="line-price" inputMode="decimal" className={INPUT} value={price} onChange={(e) => setPrice(e.target.value)} required aria-invalid={price !== '' && unit === null} /></div>
            <button type="submit" disabled={busy || !desc.trim() || unit === null || !(Number(qty) >= 1)} className="col-span-2 sm:col-span-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">{t('billing.addLine')}</button>
          </form>
          <form onSubmit={(e) => { e.preventDefault(); if (discountMinor !== null) void run(() => setInvoiceDiscount(invoice.id, discountMinor)); }} className="flex items-end gap-2 max-w-xs">
            <div className="flex-1"><label htmlFor="inv-discount" className="text-xs font-medium text-gray-600">{t('billing.discount')}</label>
              <input id="inv-discount" inputMode="decimal" className={INPUT} value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder={money(invoice.discountMinor)} aria-invalid={discount !== '' && discountMinor === null} /></div>
            <button type="submit" disabled={busy || discountMinor === null} className="bg-gray-100 px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">{t('billing.applyDiscount')}</button>
          </form>
        </>
      )}
    </section>
  );
};
