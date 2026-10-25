export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'VOID';
export type PaymentMethod = 'CASH' | 'CARD' | 'INSURANCE' | 'TRANSFER';
export const PAYMENT_METHODS: readonly PaymentMethod[] = ['CASH', 'CARD', 'INSURANCE', 'TRANSFER'];

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
}

export interface Payment {
  id: string;
  amountMinor: number;
  method: PaymentMethod;
  reference: string | null;
  receivedByName: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  /** null while DRAFT: the number is assigned when the invoice is issued. */
  number: string | null;
  status: InvoiceStatus;
  currency: string;
  discountMinor: number;
  totalMinor: number;
  paidMinor: number;
  createdAt: string;
  issuedAt: string | null;
  patient: { id: string; name: string; patientCode: string };
  lines?: InvoiceLine[];
  payments?: Payment[];
}
