import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NewAppointmentModal } from '../NewAppointmentModal';
import { createAppointment } from '../../../services/appointmentsService';
import { apiGet } from '../../../services/api';
import { toast } from 'sonner';

vi.mock('../../../services/appointmentsService', () => ({ createAppointment: vi.fn(), updateAppointment: vi.fn() }));
vi.mock('../../../services/api', () => ({ apiGet: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const PATIENT = { id: 'p1', name: 'Ali Hassan', patientCode: 'PT-7' };
const DOCTOR = { id: 'd1', name: 'Dr. Rivera', role: 'DOCTOR', department: 'ER' };

const renderModal = () =>
  render(
    <MemoryRouter>
      <NewAppointmentModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />
    </MemoryRouter>,
  );

describe('NewAppointmentModal', () => {
  beforeEach(() => {
    vi.mocked(createAppointment).mockReset().mockResolvedValue({} as never);
    vi.mocked(toast.error).mockReset();
    vi.mocked(apiGet).mockReset().mockImplementation(((url: string, params?: { search?: string }) => {
      if (url === '/staff') return Promise.resolve({ data: [DOCTOR] });
      return Promise.resolve({ data: params?.search?.startsWith('Ali') ? [PATIENT] : [] });
    }) as never);
  });

  it('sends only the id of an existing patient, never a name or an invented code', async () => {
    renderModal();
    const user = userEvent.setup();

    await user.type(screen.getAllByRole('combobox')[0], 'Ali');
    await user.click(await screen.findByRole('option', { name: /Ali Hassan/ }));
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'd1');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(createAppointment).mock.calls[0][0];
    expect(payload.patientId).toBe('p1');
    expect(payload).not.toHaveProperty('patientName');
    expect(payload).not.toHaveProperty('patientCode');
  });

  it('refuses a free-typed patient and points to the Patients page', async () => {
    renderModal();
    const user = userEvent.setup();

    await user.type(screen.getAllByRole('combobox')[0], 'Nobody Here');
    expect(await screen.findByRole('link', { name: /go to patients/i })).toHaveAttribute('href', '/patients');

    await user.selectOptions(screen.getAllByRole('combobox')[1], 'd1');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Select an existing patient from the list'));
    expect(createAppointment).not.toHaveBeenCalled();
  });
});
