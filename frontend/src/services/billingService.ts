// services/billingService.ts
import { apiGet, apiPost, apiPut, apiDelete } from './api';
import type { ApiResponse, Pagination } from '../types/api';
import type { Invoice, InvoiceStatus, PaymentMethod } from '../types/billing';

export const billingKeys = { list: ['billing', 'invoices'], one: (id: string) => ['billing', 'invoice', id] };

export const getInvoices = async (status?: InvoiceStatus): Promise<{ items: Invoice[]; pagination?: Pagination }> => {
  const res = await apiGet<ApiResponse<Invoice[]> & { pagination?: Pagination }>('/billing/invoices', { status, limit: 200 });
  return { items: res.data, pagination: res.pagination };
};
export const getInvoice = async (id: string): Promise<Invoice> => (await apiGet<ApiResponse<Invoice>>(`/billing/invoices/${id}`)).data;
export const createInvoice = async (patientId: string, includeDispensations: boolean): Promise<Invoice> =>
  (await apiPost<ApiResponse<Invoice>>('/billing/invoices', { patientId, includeDispensations })).data;
export const addInvoiceLine = (id: string, body: { description: string; quantity: number; unitPriceMinor: number }) => apiPost(`/billing/invoices/${id}/lines`, body);
export const removeInvoiceLine = (id: string, lineId: string) => apiDelete(`/billing/invoices/${id}/lines/${lineId}`);
export const setInvoiceDiscount = (id: string, discountMinor: number) => apiPut(`/billing/invoices/${id}/discount`, { discountMinor });
export const issueInvoice = (id: string) => apiPost(`/billing/invoices/${id}/issue`);
export const voidInvoice = (id: string) => apiPost(`/billing/invoices/${id}/void`);
export const recordPayment = (id: string, body: { amountMinor: number; method: PaymentMethod; reference?: string }) => apiPost(`/billing/invoices/${id}/payments`, body);
