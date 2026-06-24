import React, { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const navigate = useNavigate();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', formData);
      
      // تخزين التوكن
      localStorage.setItem('token', response.data.token);
      
      alert('تم تسجيل الدخول بنجاح!');
      
      // التوجيه التلقائي إلى الداشبورد
      navigate('/dashboard');
      
    } catch (error: any) {
      alert('خطأ في تسجيل الدخول: ' + (error.response?.data?.message || 'حدث خطأ غير معروف'));
    }
  };

  return (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome Back</h2>
      <p className="text-slate-500 mb-6">Enter your credentials to access HospiLink</p>
      
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <input 
          name="email" 
          type="email" 
          className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
          placeholder="Email Address" 
          onChange={handleChange} 
          required 
        />
        <input 
          name="password" 
          type="password" 
          className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
          placeholder="Password" 
          onChange={handleChange} 
          required 
        />
        <button 
          type="submit" 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition duration-200 mt-2"
        >
          Login
        </button>
      </form>
      
      <p className="text-center text-slate-400 mt-6 text-sm">
        Don't have an account? 
        <Link to="/signup" className="text-blue-600 hover:underline"> Sign Up</Link>
      </p>
    </div>
  </div>
);
};

export default LoginPage;