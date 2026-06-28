import React, { useState } from 'react';
import { signup } from '../services/authService';
import { Link, useNavigate } from 'react-router-dom';

export const SignupPage = () => {
  const [formData, setFormData] = useState({
    name: '', 
    email: '', 
    password: '', 
    role: 'NURSE', 
    department: 'General'
  });
  
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
  e.preventDefault();
  const dataToSend = {
    ...formData,
    hospitalId: "e4eb651b-fc3c-4284-a73d-9178e77195d8", 
    status: "Active", 
    shift: "Day"    
  };

  try {
    await signup(dataToSend);
    alert('تم إنشاء الحساب بنجاح!');
    navigate('/login');
  } catch (error: any) {
    console.error("Signup error details:", error.response?.data);
    alert('خطأ في التسجيل: ' + (error.response?.data?.message || 'تأكدي من البيانات'));
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-clinic-bg p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg border border-slate-100">
        <h2 className="text-2xl font-bold text-hospital-navy mb-6">Create Account</h2>
        
        <form onSubmit={handleSignup} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input 
            className="border border-slate-200 p-3 rounded-xl col-span-2 focus:ring-2 focus:ring-medical-teal outline-none transition" 
            placeholder="Full Name" 
            onChange={e => setFormData({...formData, name: e.target.value})} 
            required 
          />
          <input 
            className="border border-slate-200 p-3 rounded-xl col-span-2 focus:ring-2 focus:ring-medical-teal outline-none transition" 
            placeholder="Email" 
            type="email" 
            onChange={e => setFormData({...formData, email: e.target.value})} 
            required 
          />
          <input 
            className="border border-slate-200 p-3 rounded-xl col-span-2 focus:ring-2 focus:ring-medical-teal outline-none transition" 
            placeholder="Password" 
            type="password" 
            onChange={e => setFormData({...formData, password: e.target.value})} 
            required 
          />
          
          <select 
            className="border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none" 
            onChange={e => setFormData({...formData, role: e.target.value})}
          >
            <option value="NURSE">Nurse</option>
            <option value="DOCTOR">Doctor</option>
            <option value="ADMIN">Admin</option>
          </select>
          
          <select 
            className="border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none" 
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
          
          <button 
            type="submit" 
            className="col-span-2 bg-hospital-navy hover:bg-slate-800 text-white py-3 rounded-xl font-bold transition duration-200"
          >
            Sign Up
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