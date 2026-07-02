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
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(formData);
      
      if (data.user) {
        // ✅ استخدم window.location عشان React Router مش ضروري
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
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome Back</h2>
        <p className="text-slate-500 mb-6">Enter your credentials to access HospiLink</p>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input 
            name="email" 
            type="email" 
            className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
            placeholder="Email Address" 
            value={formData.email}
            onChange={handleChange} 
            required 
          />
          <input 
            name="password" 
            type="password" 
            className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
            placeholder="Password" 
            value={formData.password}
            onChange={handleChange} 
            required 
          />
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-hospital-navy hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition duration-200 mt-2 disabled:opacity-50"
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