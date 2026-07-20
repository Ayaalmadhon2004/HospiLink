// pages/LoginPage.tsx
import React, { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { login } from '../services/authService';

const LoginPage: React.FC = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(formData);

      if (data.user) {
        window.location.href = '/dashboard';
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Welcome Back</h1>
        <p className="text-slate-500 mb-6">Enter your credentials to access HospiLink</p>

        {error && (
          <div 
            className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm"
            role="alert"
            aria-live="assertive"
            id="login-error"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input 
              id="email"
              name="email" 
              type="email" 
              className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
              placeholder="you@hospital.com" 
              value={formData.email}
              onChange={handleChange} 
              required 
              autoComplete="email"
              aria-required="true"
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'login-error' : undefined}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input 
              id="password"
              name="password" 
              type="password" 
              className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
              placeholder="Enter your password" 
              value={formData.password}
              onChange={handleChange} 
              required 
              autoComplete="current-password"
              aria-required="true"
              aria-invalid={error ? 'true' : 'false'}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-hospital-navy hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition duration-200 mt-2 disabled:opacity-50"
            aria-label={loading ? 'Logging in, please wait' : 'Login to your account'}
            aria-busy={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="text-center text-slate-400 mt-6 text-sm">
          Don't have an account? 
          <Link to="/signup" className="text-medical-teal font-medium hover:underline"> Sign Up</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;