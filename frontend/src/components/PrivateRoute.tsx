// frontend/src/components/PrivateRoute.tsx
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/authContext';
import { Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { homePath, type Role } from '../configs/permissions';

interface PrivateRouteProps {
  children: React.ReactNode;
  /** When set, only these roles may see the content; other signed-in users get a 403 screen. */
  allowedRoles?: readonly Role[];
}

export const PrivateRoute = ({ children, allowedRoles }: PrivateRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  // لو لسه بيحمل بيانات المستخدم — اعرضي loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Activity className="text-teal-500 animate-pulse" size={40} />
          <p className="text-gray-600 text-sm">{t('auth.loadingSession')}</p>
        </div>
      </div>
    );
  }

  // لو مش مسجل دخول — روحي لـ login مع حفظ المسار الأصلي
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // مسجل دخول بس دوره مش مسموح لهاي الصفحة
  if (allowedRoles && !(allowedRoles as readonly string[]).includes(user.role)) {
    return (
      <div role="alert" className="min-h-[50vh] flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-gray-700 font-medium">{t('errors.forbidden')}</p>
        <Link to={homePath(user.role)} className="text-teal-600 hover:underline text-sm">
          {t('errors.backHome')}
        </Link>
      </div>
    );
  }

  // ✅ مسجل دخول — اعرضي المحتوى
  return <>{children}</>;
};