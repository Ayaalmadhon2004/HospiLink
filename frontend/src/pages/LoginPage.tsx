// frontend/src/pages/Auth/LoginPage.tsx
import { useState, type FormEvent } from 'react';
import { Activity } from 'lucide-react';
import { login } from '../services/authService';

export const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(formData);

      if (data.token && data.user) {
        // ✅ تخزين الـ token في localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // ✅ توجيه للـ Dashboard
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Activity className="text-teal-500" size={32} />
          <h1 className="text-2xl font-bold text-gray-900">HospiLink</h1>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">
          Welcome Back
        </h2>
        <p className="text-gray-500 text-sm text-center mb-6">
          Sign in to your account
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              placeholder="doctor@hospital.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.rememberMe}
                onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                className="rounded border-gray-300 text-teal-500 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-600">Remember me</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-500 text-white py-2.5 rounded-lg hover:bg-teal-600 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
