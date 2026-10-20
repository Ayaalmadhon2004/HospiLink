import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../LoginPage';
import { login } from '../../services/authService';

vi.mock('../../services/authService', () => ({ login: vi.fn() }));
const mockedLogin = vi.mocked(login);

const originalLocation = window.location;

const renderPage = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );

const fill = async () => {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('doctor@hospital.com'), 'dr@hospital.com');
  await user.type(screen.getByPlaceholderText('••••••••'), 'secret123');
  return user;
};

describe('LoginPage', () => {
  beforeEach(() => {
    mockedLogin.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '' },
    });
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('submits the entered credentials and redirects to the dashboard on success', async () => {
    mockedLogin.mockResolvedValue({ user: { id: '1' } });
    renderPage();
    const user = await fill();
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(window.location.href).toBe('/dashboard'));
    expect(mockedLogin).toHaveBeenCalledWith({
      email: 'dr@hospital.com',
      password: 'secret123',
      rememberMe: false,
    });
  });

  it('shows the server message when login resolves without a user', async () => {
    mockedLogin.mockResolvedValue({ message: 'Invalid credentials' });
    renderPage();
    const user = await fill();
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(window.location.href).toBe('');
  });

  it('shows the error message when login rejects and re-enables the button', async () => {
    mockedLogin.mockRejectedValue(new Error('Server error. Please try again later.'));
    renderPage();
    const user = await fill();
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Server error. Please try again later.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
  });

  it('does not call login while required fields are empty', async () => {
    renderPage();
    await userEvent.setup().click(screen.getByRole('button', { name: /sign in/i }));
    expect(mockedLogin).not.toHaveBeenCalled();
  });
});
