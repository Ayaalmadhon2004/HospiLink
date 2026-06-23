import React from 'react';
import { Navigate } from 'react-router-dom';

interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const token = localStorage.getItem('token');

  // إذا لم يوجد توكن، حول المستخدم لصفحة تسجيل الدخول
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // إذا وجد التوكن، اعرض الصفحة المطلوبة
  return <>{children}</>;
};

export default PrivateRoute;