// pages/SignupPage.tsx
import { logger } from '../utils/logger';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiPost } from '../services/api';
import { getErrorMessage } from '../types/api';

export const SignupPage = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '', 
    email: '', 
    password: '', 
    department: 'General',
    hospitalCode: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const dataToSend = {
      ...formData,
      shift: "DAY"
    };

    try {
      await apiPost('/auth/signup', dataToSend);
      alert(t('auth.signupSuccess'));
      navigate('/login');
    } catch (error: unknown) {
      logger.error("Signup error details:", error);
      setError(getErrorMessage(error, '') || t('auth.signupError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-clinic-bg p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg border border-slate-100">
        <h1 className="text-2xl font-bold text-hospital-navy mb-6">{t('auth.createAccount')}</h1>

        {error && (
          <div 
            className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm"
            role="alert"
            aria-live="assertive"
            id="signup-error"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
              {t('auth.fullName')}
            </label>
            <input 
              id="name"
              className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none transition" 
              placeholder={t('auth.fullNamePlaceholder')} 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})} 
              required 
              autoComplete="name"
              aria-required="true"
            />
          </div>

          <div className="col-span-2">
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              {t('auth.emailAddress')}
            </label>
            <input 
              id="email"
              className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none transition" 
              placeholder={t('auth.emailPlaceholder')} 
              type="email" 
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})} 
              required 
              autoComplete="email"
              aria-required="true"
            />
          </div>

          <div className="col-span-2">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              {t('auth.password')}
            </label>
            <input 
              id="password"
              className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none transition" 
              placeholder={t('auth.passwordPlaceholder')} 
              type="password" 
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})} 
              required 
              autoComplete="new-password"
              aria-required="true"
            />
          </div>

          <div className="col-span-2">
            <label htmlFor="hospitalCode" className="block text-sm font-medium text-slate-700 mb-1">
              {t('auth.hospitalCode')}
            </label>
            <input
              id="hospitalCode"
              className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none transition uppercase"
              placeholder={t('auth.hospitalCodePlaceholder')}
              value={formData.hospitalCode}
              onChange={e => setFormData({...formData, hospitalCode: e.target.value})}
              required
              autoComplete="off"
              aria-required="true"
            />
          </div>

          <div className="col-span-2">
            <label htmlFor="department" className="block text-sm font-medium text-slate-700 mb-1">
              {t('auth.department')}
            </label>
            <select 
              id="department"
              className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none" 
              value={formData.department}
              onChange={e => setFormData({...formData, department: e.target.value})}
            >
              <option value="Emergency">{t('departments.Emergency')}</option>
              <option value="ICU">{t('departments.ICU')}</option>
              <option value="Surgery">{t('departments.Surgery')}</option>
              <option value="Pediatrics">{t('departments.Pediatrics')}</option>
              <option value="Cardiology">{t('departments.Cardiology')}</option>
              <option value="General">{t('departments.General')}</option>
            </select>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="col-span-2 bg-hospital-navy hover:bg-teal-700 text-white py-3 rounded-xl font-bold transition duration-200 disabled:opacity-50"
            aria-label={loading ? t('auth.creatingAccountWait') : t('auth.createAccountLabel')}
            aria-busy={loading}
          >
            {loading ? t('auth.creatingAccount') : t('auth.signUp')}
          </button>
        </form>

        <p className="text-center text-slate-600 mt-6 text-sm">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="text-teal-700 font-medium hover:underline">{t('auth.login')}</Link>
        </p>
      </div>
    </div>
  );
};