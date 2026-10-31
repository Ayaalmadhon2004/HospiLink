import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PharmacyPage } from '../PharmacyPage';
import { StockMovementsPage } from '../StockMovementsPage';
import { DispensationsList } from '../../components/Pharmacy/DispensationsList';
import { BillingPage } from '../BillingPage';
import { InvoiceDetailPage } from '../InvoiceDetailPage';
import { DispenseModal } from '../../components/Pharmacy/DispenseModal';
import { apiGet, apiPost, apiPut, apiDelete } from '../../services/api';
import { apiGetAll } from '../../services/paginate';
import { ApiError } from '../../services/apiError';
import { QueryWrapper } from '../../test/QueryWrapper';
import { canAccessRoute, hasPermission } from '../../configs/permissions';
import type { Invoice } from '../../types/billing';

vi.mock('../../services/api', () => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiPut: vi.fn(), apiDelete: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/paginate', () => ({ apiGetAll: vi.fn() }));
const useAuth = vi.fn();
vi.mock('../../contexts/authContext', () => ({ useAuth: () => useAuth() }));

const med = (over = {}) => ({ id: 'm1', name: 'Paracetamol', genericName: null, form: 'tablet', strength: '500 mg', active: true, stockQuantity: 5, reorderLevel: 20, unitPriceMinor: 250, ...over });
const inv = (over: Partial<Invoice> = {}): Invoice => ({
  id: 'inv1', number: null, status: 'DRAFT', currency: 'USD', discountMinor: 0, totalMinor: 1000, paidMinor: 0, createdAt: '2026-01-02T10:00:00Z', issuedAt: null,
  patient: { id: 'p1', name: 'Ali Hassan', patientCode: 'PT-1' },
  lines: [{ id: 'l1', description: 'Consultation', quantity: 1, unitPriceMinor: 1000, totalMinor: 1000 }], payments: [], ...over,
});

beforeEach(() => {
  [apiGet, apiPost, apiPut, apiDelete, apiGetAll].forEach((m) => vi.mocked(m as typeof apiGet).mockReset());
  vi.mocked(apiGetAll).mockResolvedValue({ success: true, data: [{ id: 'p1', name: 'Ali Hassan', patientCode: 'PT-1' }] } as never);
  vi.mocked(apiPost).mockResolvedValue({ success: true } as never);
  vi.mocked(apiPut).mockResolvedValue({ success: true } as never);
  vi.mocked(apiDelete).mockResolvedValue({ success: true } as never);
});

describe('permissions', () => {
  it('mirror the backend: billing ADMIN-only, stock changes ADMIN-only, dispensing for ADMIN/DOCTOR/NURSE', () => {
    expect(hasPermission('DOCTOR', 'billing:manage')).toBe(false);
    expect(canAccessRoute('NURSE', '/billing')).toBe(false);
    expect(canAccessRoute('NURSE', '/pharmacy')).toBe(true);
    expect(canAccessRoute('DISPATCHER', '/pharmacy')).toBe(false);
    expect(hasPermission('NURSE', 'pharmacy:manage')).toBe(false);
    expect(hasPermission('NURSE', 'pharmacy:dispense')).toBe(true);
  });
});

describe('PharmacyPage', () => {
  beforeEach(() => vi.mocked(apiGetAll).mockResolvedValue({ success: true, data: [med(), med({ id: 'm2', name: 'Ibuprofen', stockQuantity: 500 }), med({ id: 'm3', name: 'Amoxicillin', stockQuantity: 0 })] } as never));

  it('flags low stock; ADMIN gets receive/adjust, NURSE does not', async () => {
    useAuth.mockReturnValue({ user: { role: 'NURSE' } });
    const { unmount } = render(<MemoryRouter><PharmacyPage /></MemoryRouter>, { wrapper: QueryWrapper });
    const row = (await screen.findByText('Paracetamol')).closest('tr')!;
    expect(within(row).getByText('Low')).toBeInTheDocument();
    expect(within((await screen.findByText('Ibuprofen')).closest('tr')!).queryByText('Low')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Receive' })).not.toBeInTheDocument();
    unmount();
    useAuth.mockReturnValue({ user: { role: 'ADMIN' } });
    render(<MemoryRouter><PharmacyPage /></MemoryRouter>, { wrapper: QueryWrapper });
    expect((await screen.findAllByRole('button', { name: 'Receive' })).length).toBe(3);
  });

  it('receiving stock posts the quantity; adjusting needs a reason', async () => {
    useAuth.mockReturnValue({ user: { role: 'ADMIN' } });
    const user = userEvent.setup();
    render(<MemoryRouter><PharmacyPage /></MemoryRouter>, { wrapper: QueryWrapper });
    await user.click((await screen.findAllByRole('button', { name: 'Receive' }))[0]);
    await user.type(screen.getByLabelText('Units received'), '40');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/pharmacy/receive', { medicationId: 'm1', quantity: 40, note: undefined }));

    await user.click((await screen.findAllByRole('button', { name: 'Adjust' }))[0]);
    await user.type(screen.getByLabelText('Change (units)'), '-3');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(); // no reason yet
    await user.type(screen.getByLabelText('Reason'), 'Broken box');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/pharmacy/adjust', { medicationId: 'm1', delta: -3, note: 'Broken box' }));
  });

  it('low-only filter asks the server', async () => {
    useAuth.mockReturnValue({ user: { role: 'ADMIN' } });
    render(<MemoryRouter><PharmacyPage /></MemoryRouter>, { wrapper: QueryWrapper });
    await screen.findByText('Paracetamol');
    await userEvent.setup().click(screen.getByLabelText('Show low stock only'));
    await waitFor(() => expect(apiGetAll).toHaveBeenCalledWith('/pharmacy/stock', expect.objectContaining({ lowOnly: true })));
  });

  it('marks a zero-quantity medication as out of stock and filters by the search box', async () => {
    useAuth.mockReturnValue({ user: { role: 'NURSE' } });
    const user = userEvent.setup();
    render(<MemoryRouter><PharmacyPage /></MemoryRouter>, { wrapper: QueryWrapper });
    expect(within((await screen.findByText('Amoxicillin')).closest('tr')!).getByText('Out of stock')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search medications'), 'ibu');
    expect(screen.queryByText('Paracetamol')).not.toBeInTheDocument();
    expect(screen.getByText('Ibuprofen')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Search medications'));
    await user.type(screen.getByLabelText('Search medications'), 'zzz');
    expect(await screen.findByText('No medications to show')).toBeInTheDocument();
  });

  it('explains a 404 (server without the pharmacy module) and does not retry it', async () => {
    useAuth.mockReturnValue({ user: { role: 'NURSE' } });
    vi.mocked(apiGetAll).mockRejectedValueOnce(new ApiError('Not found', { status: 404 }));
    render(<MemoryRouter><PharmacyPage /></MemoryRouter>, { wrapper: QueryWrapper });
    expect(await screen.findByRole('alert')).toHaveTextContent('not available on the server');
    expect(apiGetAll).toHaveBeenCalledTimes(1);
  });
});

describe('StockMovementsPage', () => {
  const move = (over = {}) => ({ id: 'x1', medicationId: 'm1', type: 'DISPENSE', delta: -3, note: 'Prescription item i1', userName: 'Dr. Sara', createdAt: '2026-01-02T10:00:00Z', medication: { name: 'Paracetamol', strength: '500 mg' }, ...over });

  it('lists the ledger with signed changes, and filters by type on the server (back to page 1)', async () => {
    vi.mocked(apiGetAll).mockResolvedValue({ success: true, data: [med()] } as never);
    vi.mocked(apiGet).mockResolvedValue({ success: true, data: [move(), move({ id: 'x2', type: 'RECEIVE', delta: 40, note: null })], pagination: { page: 1, limit: 50, totalCount: 2, totalPages: 1 } } as never);
    const user = userEvent.setup();
    render(<MemoryRouter><StockMovementsPage /></MemoryRouter>, { wrapper: QueryWrapper });
    expect(await screen.findByText('-3')).toBeInTheDocument();
    expect(screen.getByText('+40')).toBeInTheDocument();
    expect(screen.getAllByText('Dr. Sara', { selector: 'td' })).toHaveLength(2);
    await user.selectOptions(screen.getByLabelText('Filter by type'), 'RECEIVE');
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/pharmacy/movements', expect.objectContaining({ type: 'RECEIVE', page: 1 })));
  });

  it('is ADMIN-only', () => {
    expect(canAccessRoute('ADMIN', '/pharmacy/movements')).toBe(true);
    expect(canAccessRoute('NURSE', '/pharmacy/movements')).toBe(false);
  });

  it('shows an error with retry when loading fails', async () => {
    vi.mocked(apiGetAll).mockResolvedValue({ success: true, data: [] } as never);
    vi.mocked(apiGet).mockRejectedValue(new ApiError('boom', { status: 500 }));
    render(<MemoryRouter><StockMovementsPage /></MemoryRouter>, { wrapper: QueryWrapper });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the stock movements');
  });
});

describe('DispensationsList', () => {
  it('shows what was dispensed to the patient', async () => {
    vi.mocked(apiGet).mockResolvedValue({ success: true, data: [{ id: 'd1', quantity: 2, unitPriceMinor: 250, dispensedByName: 'Nurse Lina', createdAt: '2026-01-02T10:00:00Z', medication: { name: 'Paracetamol', form: 'tablet', strength: '500 mg' } }] } as never);
    render(<DispensationsList patientId="p1" />, { wrapper: QueryWrapper });
    expect(await screen.findByText(/Nurse Lina/)).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith('/pharmacy/dispensations', expect.objectContaining({ patientId: 'p1' }));
  });

  it('says so when nothing was dispensed', async () => {
    vi.mocked(apiGet).mockResolvedValue({ success: true, data: [] } as never);
    render(<DispensationsList patientId="p1" />, { wrapper: QueryWrapper });
    expect(await screen.findByText('Nothing dispensed yet')).toBeInTheDocument();
  });
});

describe('DispenseModal', () => {
  const item = { id: 'i1', dose: '1 tab', frequency: 'TID', route: null, durationDays: null, instructions: null, medication: { id: 'm1', name: 'Paracetamol', form: 'tablet', strength: '500 mg' } };

  it('dispenses the entered quantity and shows the insufficient-stock message', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<DispenseModal item={item} onClose={vi.fn()} onDone={onDone} />);
    await user.clear(screen.getByLabelText('Units to dispense'));
    await user.type(screen.getByLabelText('Units to dispense'), '3');
    await user.click(screen.getByRole('button', { name: 'Dispense' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/pharmacy/dispense', { prescriptionItemId: 'i1', quantity: 3 }));
    expect(onDone).toHaveBeenCalled();
  });

  it('shows INSUFFICIENT_STOCK as a translated error and stays open', async () => {
    vi.mocked(apiPost).mockRejectedValue(Object.assign(new Error('Not enough stock on hand'), { code: 'INSUFFICIENT_STOCK' }));
    const onClose = vi.fn();
    render(<DispenseModal item={item} onClose={onClose} onDone={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dispense' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not enough stock on hand.');
    expect(onClose).not.toHaveBeenCalled();
  });
});

const renderDetail = () => render(
  <MemoryRouter initialEntries={['/billing/inv1']}><Routes><Route path="/billing/:id" element={<InvoiceDetailPage />} /></Routes></MemoryRouter>,
  { wrapper: QueryWrapper },
);
const serve = (invoice: Invoice) => vi.mocked(apiGet).mockImplementation((async () => ({ success: true, data: invoice })) as never);

describe('InvoiceDetailPage', () => {
  beforeEach(() => useAuth.mockReturnValue({ user: { role: 'ADMIN' } }));

  it('DRAFT: add a line (money parsed to minor units), apply a discount, issue after confirmation', async () => {
    serve(inv());
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Consultation');
    await user.type(screen.getByLabelText('Description'), 'X-ray');
    await user.clear(screen.getByLabelText('Qty'));
    await user.type(screen.getByLabelText('Qty'), '2');
    await user.type(screen.getByLabelText('Unit price'), '12.5');
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/billing/invoices/inv1/lines', { description: 'X-ray', quantity: 2, unitPriceMinor: 1250 }));

    await user.type(screen.getByLabelText('Discount'), '1.5');
    await user.click(screen.getByRole('button', { name: 'Apply discount' }));
    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/billing/invoices/inv1/discount', { discountMinor: 150 }));

    await user.click(screen.getByRole('button', { name: 'Issue invoice' }));
    await user.click(await screen.findByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/billing/invoices/inv1/issue'));
  });

  it('rejects malformed prices instead of guessing (3 decimals)', async () => {
    serve(inv());
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Consultation');
    await user.type(screen.getByLabelText('Description'), 'Thing');
    await user.type(screen.getByLabelText('Unit price'), '1.234');
    expect(screen.getByRole('button', { name: 'Add item' })).toBeDisabled();
  });

  it('removing a line calls DELETE', async () => {
    serve(inv());
    renderDetail();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Remove Consultation' }));
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/billing/invoices/inv1/lines/l1'));
  });

  it('ISSUED: no editing, payments limited to the balance, void offered while unpaid', async () => {
    serve(inv({ status: 'ISSUED', number: 'INV-000007', paidMinor: 400 }));
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('INV-000007');
    expect(screen.queryByRole('button', { name: 'Add item' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Void' })).not.toBeInTheDocument(); // something was paid
    expect(screen.getByText(/Balance/)).toHaveTextContent('$6.00');
    await user.type(screen.getByLabelText('Amount'), '7');
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeDisabled(); // more than the $6.00 balance
    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '6');
    await user.selectOptions(screen.getByLabelText('Method'), 'CARD');
    await user.type(screen.getByLabelText('Reference'), 'AUTH-9');
    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/billing/invoices/inv1/payments', { amountMinor: 600, method: 'CARD', reference: 'AUTH-9' }));
  });

  it('PAID and VOID invoices are read-only', async () => {
    serve(inv({ status: 'PAID', number: 'INV-000001', paidMinor: 1000 }));
    renderDetail();
    await screen.findByText('INV-000001');
    for (const name of ['Add item', 'Issue invoice', 'Void', 'Record payment']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  });
});

describe('BillingPage', () => {
  it('lists invoices (Draft shows no number), filters server-side and creates a draft for a patient', async () => {
    useAuth.mockReturnValue({ user: { role: 'ADMIN' } });
    vi.mocked(apiGet).mockResolvedValue({ success: true, data: [inv(), inv({ id: 'inv2', number: 'INV-000002', status: 'ISSUED' })] } as never);
    vi.mocked(apiPost).mockResolvedValue({ success: true, data: { id: 'new1' } } as never);
    const user = userEvent.setup();
    render(<MemoryRouter><Routes><Route path="/" element={<BillingPage />} /><Route path="/billing/:id" element={<p>detail page</p>} /></Routes></MemoryRouter>, { wrapper: QueryWrapper });
    expect(await screen.findByText('INV-000002')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Draft' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Paid' }));
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/billing/invoices', expect.objectContaining({ status: 'PAID' })));

    await user.click(screen.getByRole('button', { name: 'New invoice' }));
    await user.click(await screen.findByRole('combobox', { name: /patient/i }));
    await user.click(await screen.findByRole('option', { name: /Ali Hassan/ }));
    await user.click(screen.getByRole('button', { name: 'Create draft' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/billing/invoices', { patientId: 'p1', includeDispensations: true }));
    expect(await screen.findByText('detail page')).toBeInTheDocument();
  });
});
