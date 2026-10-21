import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardShell } from '../DashboardShell';

const renderShell = () =>
  render(
    <DashboardShell
      title="Patients"
      mainLabel="Patients panel"
      renderSidebar={(closeMenu) => (
        <nav aria-label="Main menu">
          <button onClick={closeMenu}>Go to Beds</button>
        </nav>
      )}
    >
      <p>content</p>
    </DashboardShell>,
  );

describe('DashboardShell', () => {
  it('shows the section title and the content, with the menu closed', () => {
    renderShell();
    expect(screen.getByText('Patients')).toBeInTheDocument();
    expect(screen.getByRole('main', { name: 'Patients panel' })).toHaveTextContent('content');
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('sidebar-backdrop')).not.toBeInTheDocument();
  });

  it('opens the menu from the top bar button and closes it again', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('sidebar-backdrop')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.queryByTestId('sidebar-backdrop')).not.toBeInTheDocument();
  });

  it('closes on Escape, on a backdrop click and after choosing an item', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('sidebar-backdrop')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByTestId('sidebar-backdrop'));
    expect(screen.queryByTestId('sidebar-backdrop')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('button', { name: 'Go to Beds' }));
    expect(screen.queryByTestId('sidebar-backdrop')).not.toBeInTheDocument();
  });

  it('renders the actions slot outside the main content', () => {
    render(
      <DashboardShell title="Patients" mainLabel="Patients panel" renderSidebar={() => <nav />} actions={<button>Bell</button>}>
        <p>content</p>
      </DashboardShell>,
    );
    expect(screen.getByRole('button', { name: 'Bell' })).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toContainElement(screen.getByRole('button', { name: 'Bell' }));
  });
});
