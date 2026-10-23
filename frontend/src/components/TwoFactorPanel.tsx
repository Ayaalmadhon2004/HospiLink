import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { setupTwoFactor, enableTwoFactor, disableTwoFactor } from '../services/authService';
import { getErrorMessage } from '../types/api';

type Step =
  | { name: 'idle' }
  | { name: 'setup'; secret: string; otpauthUrl: string }
  | { name: 'codes'; codes: string[] }
  | { name: 'disable' };

const INPUT_CLASS =
  'w-full px-4 py-2 border border-gray-200 rounded-lg text-gray-800 bg-white focus:ring-2 focus:ring-teal-500 outline-none';
const PRIMARY_BUTTON =
  'px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-medium hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed';
const SECONDARY_BUTTON = 'px-4 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50';

/** Enable / disable TOTP two-factor authentication. `onChanged` refetches the settings. */
export const TwoFactorPanel = ({ enabled, onChanged }: { enabled: boolean; onChanged: () => void }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>({ name: 'idle' });
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep({ name: 'idle' });
    setCode('');
    setPassword('');
    setUseRecovery(false);
    setError('');
  };

  const run = async (action: () => Promise<void>, fallback: string) => {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (err: unknown) {
      setError(getErrorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const startSetup = () =>
    run(async () => {
      const res = await setupTwoFactor();
      setStep({ name: 'setup', secret: res.data.secret, otpauthUrl: res.data.otpauthUrl });
    }, t('settings.security.twoFactorAuth.setupError'));

  const submitEnable = (e: FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const res = await enableTwoFactor(code);
      setCode('');
      setStep({ name: 'codes', codes: res.data.recoveryCodes });
      toast.success(t('settings.security.twoFactorAuth.enabledToast'));
    }, t('errors.unexpectedError'));
  };

  const submitDisable = (e: FormEvent) => {
    e.preventDefault();
    return run(async () => {
      await disableTwoFactor(password, useRecovery ? { recoveryCode: code } : { code });
      toast.success(t('settings.security.twoFactorAuth.disabledToast'));
      reset();
      onChanged();
    }, t('errors.unexpectedError'));
  };

  const finishCodes = () => {
    reset();
    onChanged();
  };

  const copyCodes = async (codes: string[]) => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      toast.success(t('settings.security.twoFactorAuth.copied'));
    } catch {
      // Clipboard can be blocked; the codes stay visible on screen.
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-medium text-gray-800 flex flex-wrap items-center gap-2">
            {t('settings.security.twoFactorAuth.title')}
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {enabled ? t('settings.security.twoFactorAuth.statusOn') : t('settings.security.twoFactorAuth.statusOff')}
            </span>
          </h3>
          <p className="text-sm text-gray-600">{t('settings.security.twoFactorAuth.description')}</p>
        </div>
        {step.name === 'idle' && (
          <button
            type="button"
            className={enabled ? SECONDARY_BUTTON : PRIMARY_BUTTON}
            disabled={busy}
            onClick={() => (enabled ? setStep({ name: 'disable' }) : startSetup())}
          >
            {enabled ? t('settings.security.twoFactorAuth.disable') : t('settings.security.twoFactorAuth.enable')}
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="mt-4 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {step.name === 'setup' && (
        <form onSubmit={submitEnable} className="mt-4 space-y-4">
          <p className="text-sm text-gray-700">{t('settings.security.twoFactorAuth.scanQr')}</p>
          <div className="inline-block bg-white p-3 border border-gray-200 rounded-lg">
            <QRCodeSVG value={step.otpauthUrl} size={160} role="img" aria-label={t('settings.security.twoFactorAuth.qrLabel')} />
          </div>
          <p className="text-sm text-gray-600">
            {t('settings.security.twoFactorAuth.manualKey')}{' '}
            <code className="font-mono text-gray-800 break-all" dir="ltr">{step.secret}</code>
          </p>
          <div>
            <label htmlFor="tf-enable-code" className="block text-sm font-medium text-gray-700 mb-1">
              {t('settings.security.twoFactorAuth.codeLabel')}
            </label>
            <input
              id="tf-enable-code"
              className={`${INPUT_CLASS} max-w-48`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="\d{6}"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className={PRIMARY_BUTTON} disabled={busy || code.length !== 6}>
              {t('settings.security.twoFactorAuth.verifyEnable')}
            </button>
            <button type="button" className={SECONDARY_BUTTON} onClick={reset}>
              {t('settings.security.twoFactorAuth.cancel')}
            </button>
          </div>
        </form>
      )}

      {step.name === 'codes' && (
        <div className="mt-4 space-y-4">
          <h4 className="font-medium text-gray-800">{t('settings.security.twoFactorAuth.recoveryTitle')}</h4>
          <p className="text-sm text-gray-700">{t('settings.security.twoFactorAuth.recoveryWarning')}</p>
          <ul className="grid grid-cols-2 gap-2 max-w-sm font-mono text-sm text-gray-800" dir="ltr">
            {step.codes.map((c) => (
              <li key={c} className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5">{c}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" className={SECONDARY_BUTTON} onClick={() => copyCodes(step.codes)}>
              {t('settings.security.twoFactorAuth.copyCodes')}
            </button>
            <button type="button" className={PRIMARY_BUTTON} onClick={finishCodes}>
              {t('settings.security.twoFactorAuth.savedConfirm')}
            </button>
          </div>
        </div>
      )}

      {step.name === 'disable' && (
        <form onSubmit={submitDisable} className="mt-4 space-y-4">
          <h4 className="font-medium text-gray-800">{t('settings.security.twoFactorAuth.disableTitle')}</h4>
          <div>
            <label htmlFor="tf-disable-password" className="block text-sm font-medium text-gray-700 mb-1">
              {t('settings.security.twoFactorAuth.currentPassword')}
            </label>
            <input
              id="tf-disable-password"
              type="password"
              className={`${INPUT_CLASS} max-w-sm`}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="tf-disable-code" className="block text-sm font-medium text-gray-700 mb-1">
              {useRecovery ? t('auth.recoveryCode') : t('settings.security.twoFactorAuth.codeLabel')}
            </label>
            <input
              id="tf-disable-code"
              className={`${INPUT_CLASS} max-w-48`}
              inputMode={useRecovery ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              maxLength={useRecovery ? 11 : 6}
              value={code}
              onChange={(e) => setCode(useRecovery ? e.target.value : e.target.value.replace(/\D/g, ''))}
              required
            />
            <button
              type="button"
              className="block mt-1 text-sm text-teal-700 hover:underline"
              onClick={() => {
                setUseRecovery(!useRecovery);
                setCode('');
              }}
            >
              {useRecovery ? t('auth.useAuthenticatorCode') : t('auth.useRecoveryCode')}
            </button>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={PRIMARY_BUTTON} disabled={busy || !password || !code}>
              {t('settings.security.twoFactorAuth.confirmDisable')}
            </button>
            <button type="button" className={SECONDARY_BUTTON} onClick={reset}>
              {t('settings.security.twoFactorAuth.cancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
