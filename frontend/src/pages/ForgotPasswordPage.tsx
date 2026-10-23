import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { forgotPassword } from '../services/authService';
import { getErrorMessage } from '../types/api';
import { AuthCard, AuthMessage, authButtonClass, authInputClass } from '../components/AuthCard';

export const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('errors.unexpectedError')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')}>
      {error && <AuthMessage kind="error">{error}</AuthMessage>}
      {sent ? (
        <AuthMessage kind="success">{t('auth.resetEmailSent')}</AuthMessage>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.email')}
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authInputClass}
              placeholder="doctor@hospital.com"
              autoComplete="email"
              required
            />
          </div>
          <button type="submit" disabled={loading} className={authButtonClass}>
            {loading ? t('auth.sending') : t('auth.sendResetLink')}
          </button>
        </form>
      )}
      <p className="text-center mt-6 text-sm">
        <Link to="/login" className="text-teal-700 font-medium hover:underline">{t('auth.backToLogin')}</Link>
      </p>
    </AuthCard>
  );
};
