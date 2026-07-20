// pages/SignupPage.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiPost } from '../services/api';

export const SignupPage = () => {
  const [formData, setFormData] = useState({
    name: '', 
    email: '', 
    password: '', 
    role: 'NURSE', 
    department: 'General'
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
      hospitalId: "e4eb651b-fc3c-4284-a73d-9178e77195d8", 
      status: "Active", 
      shift: "Day"    
    };

    try {
      await apiPost('/auth/signup', dataToSend);
      alert('تم إنشاء الحساب بنجاح!');
      navigate('/login');
    } catch (error: any) {
      console.error("Signup error details:", error);
      setError(error.message || 'خطأ في التسجيل: تأكدي من البيانات');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-clinic-bg p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg border border-slate-100">
        <h1 className="text-2xl font-bold text-hospital-navy mb-6">Create Account</h1>

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
              Full Name
            </label>
            <input 
              id="name"
              className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none transition" 
              placeholder="Dr. John Smith" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})} 
              required 
              autoComplete="name"
              aria-required="true"
            />
          </div>

          <div className="col-span-2">
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input 
              id="email"
              className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none transition" 
              placeholder="doctor@hospital.com" 
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
              Password
            </label>
            <input 
              id="password"
              className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none transition" 
              placeholder="Create a strong password" 
              type="password" 
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})} 
              required 
              autoComplete="new-password"
              aria-required="true"
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-slate-700 mb-1">
              Role
            </label>
            <select 
              id="role"
              className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none" 
              value={formData.role}
              onChange={e => setFormData({...formData, role: e.target.value})}
              aria-describedby="role-help"
            >
              <option value="NURSE">Nurse</option>
              <option value="DOCTOR">Doctor</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div>
            <label htmlFor="department" className="block text-sm font-medium text-slate-700 mb-1">
              Department
            </label>
            <select 
              id="department"
              className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none" 
              value={formData.department}
              onChange={e => setFormData({...formData, department: e.target.value})}
            >
              <option value="Emergency">Emergency</option>
              <option value="ICU">ICU</option>
              <option value="Surgery">Surgery</option>
              <option value="Pediatrics">Pediatrics</option>
              <option value="Cardiology">Cardiology</option>
              <option value="General">General</option>
            </select>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="col-span-2 bg-hospital-navy hover:bg-slate-800 text-white py-3 rounded-xl font-bold transition duration-200 disabled:opacity-50"
            aria-label={loading ? 'Creating account, please wait' : 'Create account'}
            aria-busy={loading}
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center text-slate-400 mt-6 text-sm">
          Do you already have an account? 
          <Link to="/login" className="text-medical-teal font-medium hover:underline"> Login</Link>
        </p>
      </div>
    </div>
  );
};