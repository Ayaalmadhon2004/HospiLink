// frontend/src/pages/Auth/LoginPage.tsx
import { useState, type FormEvent } from 'react';
import { Activity } from 'lucide-react';
import { login, resendVerification } from '../services/authService';
import { getErrorMessage } from '../types/api';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export const LoginPage = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resent, setResent] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNeedsVerification(false);
    setResent(false);
    setLoading(true);

    try {
      const data = await login(formData);

      if (data.user) {
        // الجلسة بتنحفظ بكوكي httpOnly (ما في token بالـ localStorage)

        // ✅ توجيه للـ Dashboard
        window.location.href = '/dashboard';
      } else {
        setError(data.message || t('auth.loginFailed'));
      }
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'EMAIL_NOT_VERIFIED') {
        setNeedsVerification(true);
        setError(t('auth.emailNotVerified'));
      } else {
        setError(getErrorMessage(err, '') || t('auth.loginFailedCheck'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendVerification(formData.email);
    } catch {
      // The endpoint always answers 200; a network failure just leaves the button available.
      return;
    }
    setResent(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
      <LanguageSwitcher className="absolute top-4 end-4 text-gray-700 hover:bg-gray-100" />
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Activity className="text-teal-500" size={32} />
          <h1 className="text-2xl font-bold text-gray-900">HospiLink</h1>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">
          {t('auth.welcomeBack')}
        </h2>
        <p className="text-gray-500 text-sm text-center mb-6">
          {t('auth.signInSubtitle')}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
            {error}
            {needsVerification && (
              <div className="mt-2">
                {resent ? (
                  <span role="status">{t('auth.verificationResent')}</span>
                ) : (
                  <button type="button" onClick={handleResend} className="underline font-medium">
                    {t('auth.resendVerification')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.email')}
            </label>
            <input
              id="login-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              placeholder="doctor@hospital.com"
              required
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.password')}
            </label>
            <input
              id="login-password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <label htmlFor="remember-me" className="flex items-center gap-2 cursor-pointer">
              <input
                id="remember-me"
                type="checkbox"
                checked={formData.rememberMe}
                onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                className="rounded border-gray-300 text-teal-500 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-600">{t('auth.rememberMe')}</span>
            </label>
            <Link to="/forgot-password" className="text-sm text-teal-700 font-medium hover:underline">
              {t('auth.forgotPassword')}
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-700 text-white py-2.5 rounded-lg hover:bg-teal-800 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </button>

          <p className="text-center text-slate-600 mt-6 text-sm">
          {t('auth.noAccount')}{' '}
          <Link to="/signup" className="text-teal-700 font-medium hover:underline">{t('auth.signUp')}</Link>
        </p>
        </form>
      </div>
    </div>
  );
};
