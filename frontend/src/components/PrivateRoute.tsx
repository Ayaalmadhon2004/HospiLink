// frontend/src/components/PrivateRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Activity } from 'lucide-react';

interface PrivateRouteProps {
  children: React.ReactNode;
}

export const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // لو لسه بيحمل بيانات المستخدم — اعرضي loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Activity className="text-teal-500 animate-pulse" size={40} />
          <p className="text-gray-400 text-sm">Loading your session...</p>
        </div>
      </div>
    );
  }

  // لو مش مسجل دخول — روحي لـ login مع حفظ المسار الأصلي
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ✅ مسجل دخول — اعرضي المحتوى
  return <>{children}</>;
};