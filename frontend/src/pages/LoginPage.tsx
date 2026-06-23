import React, { useState } from 'react';
import type {ChangeEvent, FormEvent} from 'react';
import axios from 'axios';

const LoginPage: React.FC = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', formData);
      localStorage.setItem('token', response.data.token);
      alert('تم تسجيل الدخول بنجاح!');
    } catch (error: any) {
      alert('خطأ في تسجيل الدخول: ' + (error.response?.data?.message || 'حدث خطأ غير معروف'));
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input 
        name="email" 
        type="email" 
        placeholder="Email" 
        onChange={handleChange} 
        required 
      />
      <input 
        name="password" 
        type="password" 
        placeholder="Password" 
        onChange={handleChange} 
        required 
      />
      <button type="submit">Login</button>
    </form>
  );
};

export default LoginPage;