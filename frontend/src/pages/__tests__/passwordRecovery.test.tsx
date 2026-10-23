import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ForgotPasswordPage } from '../ForgotPasswordPage';
import { ResetPasswordPage } from '../ResetPasswordPage';
import { VerifyEmailPage } from '../VerifyEmailPage';
import { forgotPassword, resetPassword, verifyEmail } from '../../services/authService';

vi.mock('../../services/authService', () => ({
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  verifyEmail: vi.fn(),
}));

const setHash = (hash: string) => window.history.replaceState(null, '', `/x${hash}`);
const renderPage = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('password recovery pages', () => {
  beforeEach(() => {
    vi.mocked(forgotPassword).mockReset();
    vi.mocked(resetPassword).mockReset();
    vi.mocked(verifyEmail).mockReset();
    setHash('');
  });

  it('forgot password: sends the email and shows the generic confirmation', async () => {
    vi.mocked(forgotPassword).mockResolvedValue({});
    renderPage(<ForgotPasswordPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'dr@hospital.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(forgotPassword).toHaveBeenCalledWith('dr@hospital.com');
    expect(await screen.findByText(/we have sent a message/i)).toBeInTheDocument();
  });

  it('reset password: asks for a new link when the token is missing', () => {
    renderPage(<ResetPasswordPage />);
    expect(screen.getByText(/missing its token/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a new link/i })).toHaveAttribute('href', '/forgot-password');
  });

  it('reset password: validates, submits the token from the fragment and strips it from the URL', async () => {
    setHash('#token=abc123abc123abc123abc123');
    vi.mocked(resetPassword).mockResolvedValue({});
    renderPage(<ResetPasswordPage />);
    expect(window.location.hash).toBe('');
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('New password'), 'short');
    await user.type(screen.getByLabelText('Confirm password'), 'short');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('New password'));
    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('New password'), 'long-enough-1');
    await user.type(screen.getByLabelText('Confirm password'), 'different-1');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Confirm password'), 'long-enough-1');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('abc123abc123abc123abc123', 'long-enough-1'));
    expect(await screen.findByText(/you can sign in now/i)).toBeInTheDocument();
  });

  it('verify email: confirms once with the token from the fragment', async () => {
    setHash('#token=abc123abc123abc123abc123');
    vi.mocked(verifyEmail).mockResolvedValue({});
    renderPage(<VerifyEmailPage />);

    expect(await screen.findByText(/email verified/i)).toBeInTheDocument();
    expect(verifyEmail).toHaveBeenCalledTimes(1);
    expect(verifyEmail).toHaveBeenCalledWith('abc123abc123abc123abc123');
  });

  it('verify email: shows an error for a bad link', async () => {
    setHash('#token=abc123abc123abc123abc123');
    vi.mocked(verifyEmail).mockRejectedValue(new Error('Invalid or expired link'));
    renderPage(<VerifyEmailPage />);
    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
  });

  it('verify email: fails without calling the API when there is no token', () => {
    renderPage(<VerifyEmailPage />);
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(verifyEmail).not.toHaveBeenCalled();
  });
});
