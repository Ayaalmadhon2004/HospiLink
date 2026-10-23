import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TwoFactorPanel } from '../TwoFactorPanel';
import { setupTwoFactor, enableTwoFactor, disableTwoFactor } from '../../services/authService';

vi.mock('../../services/authService', () => ({
  setupTwoFactor: vi.fn(),
  enableTwoFactor: vi.fn(),
  disableTwoFactor: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('TwoFactorPanel', () => {
  beforeEach(() => {
    vi.mocked(setupTwoFactor).mockReset();
    vi.mocked(enableTwoFactor).mockReset();
    vi.mocked(disableTwoFactor).mockReset();
  });

  it('enable flow: QR + secret, verify the code, show recovery codes once, then refresh', async () => {
    vi.mocked(setupTwoFactor).mockResolvedValue({ data: { secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/HospiLink:a?secret=JBSWY3DPEHPK3PXP' } });
    vi.mocked(enableTwoFactor).mockResolvedValue({ data: { recoveryCodes: ['aaaaa-11111', 'bbbbb-22222'] } });
    const onChanged = vi.fn();
    render(<TwoFactorPanel enabled={false} onChanged={onChanged} />);
    const user = userEvent.setup();

    expect(screen.getByText('Not enabled')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enable' }));

    expect(await screen.findByRole('img', { name: /qr code/i })).toBeInTheDocument();
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();

    const submit = screen.getByRole('button', { name: /verify and enable/i });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText(/6-digit code/i), '123456');
    await user.click(submit);

    expect(enableTwoFactor).toHaveBeenCalledWith('123456');
    expect(await screen.findByText('aaaaa-11111')).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /i have saved/i }));
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('aaaaa-11111')).not.toBeInTheDocument();
  });

  it('shows the server error for a wrong code and keeps the setup open', async () => {
    vi.mocked(setupTwoFactor).mockResolvedValue({ data: { secret: 'S', otpauthUrl: 'otpauth://totp/x?secret=S' } });
    vi.mocked(enableTwoFactor).mockRejectedValue(new Error('Invalid verification code'));
    render(<TwoFactorPanel enabled={false} onChanged={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Enable' }));
    await user.type(await screen.findByLabelText(/6-digit code/i), '000000');
    await user.click(screen.getByRole('button', { name: /verify and enable/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid verification code');
    expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument();
  });

  it('disable flow: needs the password and a code', async () => {
    vi.mocked(disableTwoFactor).mockResolvedValue({});
    const onChanged = vi.fn();
    render(<TwoFactorPanel enabled onChanged={onChanged} />);
    const user = userEvent.setup();

    expect(screen.getByText('Enabled')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Disable' }));
    const confirm = screen.getByRole('button', { name: /disable two-factor authentication/i });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(/current password/i), 'pw-correct');
    await user.type(screen.getByLabelText(/6-digit code/i), '123456');
    await user.click(confirm);

    await waitFor(() => expect(disableTwoFactor).toHaveBeenCalledWith('pw-correct', { code: '123456' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it('disable flow can use a recovery code', async () => {
    vi.mocked(disableTwoFactor).mockResolvedValue({});
    render(<TwoFactorPanel enabled onChanged={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Disable' }));
    await user.click(screen.getByRole('button', { name: /use a recovery code/i }));
    await user.type(screen.getByLabelText(/current password/i), 'pw-correct');
    await user.type(screen.getByLabelText(/recovery code/i), 'abcde-12345');
    await user.click(screen.getByRole('button', { name: /disable two-factor authentication/i }));

    await waitFor(() => expect(disableTwoFactor).toHaveBeenCalledWith('pw-correct', { recoveryCode: 'abcde-12345' }));
  });
});
