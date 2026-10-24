import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy ,Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';

// Named exports → wrap with default via .then()
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const Dashboard = lazy(() => import('./pages/Dashboard'));
import { ErrorBoundary } from './components/ErrorBoundary';
import { PrivateRoute } from './components/PrivateRoute';
import { AppLayout } from './components/Layout/AppLayout';
const SignupPage = lazy(() => import('./pages/SignupPage').then(m => ({ default: m.SignupPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })));
const PatientsPage = lazy(() => import('./pages/PatientsPage').then(m => ({ default: m.PatientsPage })));
const PatientDetailPage = lazy(() => import('./pages/PatientDetailPage').then(m => ({ default: m.PatientDetailPage })));
const EditPatientPage = lazy(() => import('./pages/EditPatientPage').then(m => ({ default: m.EditPatientPage })));
const Beds = lazy(() => import('./pages/Beds'));
const VitalsMonitorPage = lazy(() => import('./pages/VitalsMonitorPage').then(m => ({ default: m.VitalsMonitorPage })));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage').then(m => ({ default: m.AppointmentsPage })));
const DispatchDashboard = lazy(() => import('./pages/DispatchDashboard'));
const IncidentsPage = lazy(() => import('./pages/IncidentsPage').then(m => ({ default: m.IncidentsPage })));
const StaffDirectoryPage = lazy(() => import('./pages/StaffDirectoryPage').then(m => ({ default: m.StaffDirectoryPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function App() {
  const { t } = useTranslation();
  return (
    <ErrorBoundary>
    <Toaster position="top-right" richColors closeButton />
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-clinic-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">{t('common.loading')}</p>
        </div>
      </div>
    }>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        {/* Signed-in sections share the sidebar layout; the URL is the only navigation state */}
        <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/beds" element={<Beds />} />
          <Route path="/staff" element={<StaffDirectoryPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/vitals" element={<VitalsMonitorPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/dispatch" element={<DispatchDashboard />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Full-page patient screens (own header, no sidebar) */}
        <Route path="/patients/:id" element={<PrivateRoute><PatientDetailPage /></PrivateRoute>} />
        <Route path="/patients/:id/edit" element={<PrivateRoute><EditPatientPage /></PrivateRoute>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}

export default App;