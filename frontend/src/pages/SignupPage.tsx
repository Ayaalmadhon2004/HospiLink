import React, { useState } from 'react';
import { signup } from '../services/authService';
import { useNavigate } from 'react-router-dom';

export const SignupPage = () => {
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'NURSE', department: 'General', hospitalId: 'HOSP-001'
  });
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signup(formData);
      alert('تم إنشاء الحساب بنجاح! يرجى تسجيل الدخول.');
      navigate('/login');
    } catch (error) {
      alert('خطأ في التسجيل، تأكدي من صحة البيانات.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Create Account</h2>
        <form onSubmit={handleSignup} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className="border p-3 rounded-xl col-span-2" placeholder="Full Name" onChange={e => setFormData({...formData, name: e.target.value})} required />
          <input className="border p-3 rounded-xl col-span-2" placeholder="Email" type="email" onChange={e => setFormData({...formData, email: e.target.value})} required />
          <input className="border p-3 rounded-xl col-span-2" placeholder="Password" type="password" onChange={e => setFormData({...formData, password: e.target.value})} required />
          
          <select className="border p-3 rounded-xl" onChange={e => setFormData({...formData, role: e.target.value})}>
            <option value="NURSE">Nurse</option>
            <option value="DOCTOR">Doctor</option>
            <option value="ADMIN">Admin</option>
          </select>
          
          <input className="border p-3 rounded-xl" placeholder="Department" onChange={e => setFormData({...formData, department: e.target.value})} />
          
          <button type="submit" className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition">
            Sign Up
          </button>
        </form>
      </div>
    </div>
  );
};