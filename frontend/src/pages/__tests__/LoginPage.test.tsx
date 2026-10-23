import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../LoginPage';
import { login, resendVerification, verifyTwoFactor } from '../../services/authService';

vi.mock('../../services/authService', () => ({ login: vi.fn(), resendVerification: vi.fn(), verifyTwoFactor: vi.fn() }));
const mockedLogin = vi.mocked(login);
const mockedResend = vi.mocked(resendVerification);
const mockedVerify = vi.mocked(verifyTwoFactor);

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

  it('offers to resend the verification email when the account is not verified', async () => {
    mockedLogin.mockRejectedValue(Object.assign(new Error('Please verify your email address'), { code: 'EMAIL_NOT_VERIFIED' }));
    mockedResend.mockResolvedValue({});
    renderPage();
    const user = await fill();
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await user.click(await screen.findByRole('button', { name: /resend verification/i }));

    expect(mockedResend).toHaveBeenCalledWith('dr@hospital.com');
    expect(await screen.findByText(/new verification email is on its way/i)).toBeInTheDocument();
  });

  it('links to the forgot-password page', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute('href', '/forgot-password');
  });

  describe('two-factor step', () => {
    const toSecondStep = async () => {
      mockedLogin.mockResolvedValue({ twoFactorRequired: true, challengeToken: 'challenge-token' });
      renderPage();
      const user = await fill();
      await user.click(screen.getByRole('button', { name: /sign in/i }));
      await screen.findByRole('heading', { name: /two-factor verification/i });
      return user;
    };

    it('asks for the code instead of redirecting, then signs in with it', async () => {
      const user = await toSecondStep();
      expect(window.location.href).toBe('');

      mockedVerify.mockResolvedValue({ user: { id: '1' } });
      await user.type(screen.getByLabelText(/verification code/i), '12a3456');
      expect(screen.getByLabelText(/verification code/i)).toHaveValue('123456');
      await user.click(screen.getByRole('button', { name: /^verify$/i }));

      await waitFor(() => expect(window.location.href).toBe('/dashboard'));
      expect(mockedVerify).toHaveBeenCalledWith('challenge-token', { code: '123456' });
    });

    it('can use a recovery code instead', async () => {
      const user = await toSecondStep();
      mockedVerify.mockResolvedValue({ user: { id: '1' } });

      await user.click(screen.getByRole('button', { name: /use a recovery code/i }));
      await user.type(screen.getByLabelText(/recovery code/i), 'abcde-12345');
      await user.click(screen.getByRole('button', { name: /^verify$/i }));

      await waitFor(() => expect(mockedVerify).toHaveBeenCalledWith('challenge-token', { recoveryCode: 'abcde-12345' }));
    });

    it('shows the server error for a wrong code and stays on the step', async () => {
      const user = await toSecondStep();
      mockedVerify.mockRejectedValue(new Error('Invalid verification code'));

      await user.type(screen.getByLabelText(/verification code/i), '000000');
      await user.click(screen.getByRole('button', { name: /^verify$/i }));

      expect(await screen.findByText('Invalid verification code')).toBeInTheDocument();
      expect(window.location.href).toBe('');
    });

    it('cancel returns to the password form and drops the challenge', async () => {
      const user = await toSecondStep();
      await user.click(screen.getByRole('button', { name: /cancel sign in/i }));
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
  });
});
