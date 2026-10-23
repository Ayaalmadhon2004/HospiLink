import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { verifyEmail } from '../services/authService';
import { useFragmentToken } from '../hooks/useFragmentToken';
import { AuthCard, AuthMessage } from '../components/AuthCard';

type Status = 'loading' | 'success' | 'failed';

export const VerifyEmailPage = () => {
  const { t } = useTranslation();
  const token = useFragmentToken();
  const [status, setStatus] = useState<Status>(token ? 'loading' : 'failed');
  // Tokens are single-use: never send the request twice (React StrictMode runs effects twice in dev).
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('failed'));
  }, [token]);

  return (
    <AuthCard title={t('auth.verifyTitle')}>
      {status === 'loading' && <p className="text-center text-sm text-gray-500" role="status">{t('auth.verifying')}</p>}
      {status === 'success' && <AuthMessage kind="success">{t('auth.verifySuccess')}</AuthMessage>}
      {status === 'failed' && <AuthMessage kind="error">{t('auth.verifyFailed')}</AuthMessage>}
      <p className="text-center mt-4 text-sm">
        <Link to="/login" className="text-teal-700 font-medium hover:underline">{t('auth.backToLogin')}</Link>
      </p>
    </AuthCard>
  );
};
