import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../AppLayout';

vi.mock('../../../contexts/authContext', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Dr Who', email: 'd@h.com', role: 'DOCTOR' }, loading: false }),
}));
vi.mock('../../../hooks/useSidebarBadges', () => ({
  useSidebarBadges: () => ({ Patients: '3', Appointments: null, Vitals: null, Incidents: null }),
}));
vi.mock('../../NotificationBell', () => ({ NotificationBell: () => null }));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<p>overview page</p>} />
          <Route path="/patients" element={<p>patients page</p>} />
          <Route path="/patients/:id" element={<p>patient detail</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe('AppLayout', () => {
  it('renders the section of the URL and marks its sidebar link as current', () => {
    renderAt('/patients');
    expect(screen.getByText('patients page')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Patients/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('main')).toHaveAttribute('aria-label', expect.stringContaining('Patients'));
    expect(document.title).toBe('Patients | HospiLink');
  });

  it('navigates through the sidebar links: the URL is the only state', async () => {
    renderAt('/dashboard');
    expect(screen.getByText('overview page')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('link', { name: /^Patients/ }));

    expect(screen.getByText('patients page')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Patients/ })).toHaveAttribute('aria-current', 'page');
    expect(document.title).toBe('Patients | HospiLink');
  });

  it('keeps the parent section highlighted on nested routes and shows the badge', () => {
    renderAt('/patients/7');
    expect(screen.getByRole('link', { name: /^Patients/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /^Patients/ })).toHaveTextContent('3');
  });
});
