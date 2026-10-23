import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { resetPassword } from '../services/authService';
import { getErrorMessage } from '../types/api';
import { useFragmentToken } from '../hooks/useFragmentToken';
import { AuthCard, AuthMessage, authButtonClass, authInputClass } from '../components/AuthCard';

export const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const token = useFragmentToken();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError(t('auth.passwordTooShort'));
    if (password !== confirm) return setError(t('auth.passwordsMismatch'));
    if (!token) return;
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('errors.unexpectedError')));
    } finally {
      setLoading(false);
    }
  };

  if (!token && !done) {
    return (
      <AuthCard title={t('auth.resetTitle')}>
        <AuthMessage kind="error">{t('auth.linkMissing')}</AuthMessage>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="text-teal-700 font-medium hover:underline">{t('auth.requestNewLink')}</Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('auth.resetTitle')}>
      {error && <AuthMessage kind="error">{error}</AuthMessage>}
      {done ? (
        <>
          <AuthMessage kind="success">{t('auth.resetSuccess')}</AuthMessage>
          <p className="text-center text-sm">
            <Link to="/login" className="text-teal-700 font-medium hover:underline">{t('auth.signIn')}</Link>
          </p>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">{t('auth.newPassword')}</label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={authInputClass}
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">{t('auth.confirmPassword')}</label>
            <input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={authInputClass}
              autoComplete="new-password"
              required
            />
          </div>
          <button type="submit" disabled={loading} className={authButtonClass}>
            {loading ? t('auth.sending') : t('auth.resetPassword')}
          </button>
        </form>
      )}
    </AuthCard>
  );
};
