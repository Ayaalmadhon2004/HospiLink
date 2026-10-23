import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy ,Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';

// Named exports → wrap with default via .then()
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const Dashboard = lazy(() => import('./pages/Dashboard'));
import { ErrorBoundary } from './components/ErrorBoundary';
import { PrivateRoute } from './components/PrivateRoute';
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

        {/* Protected Routes */}
        <Route 
          path="/dashboard" 
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } 
        />

        <Route 
          path="/patients" 
          element={
            <PrivateRoute>
              <PatientsPage />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/patients/:id" 
          element={
            <PrivateRoute>
              <PatientDetailPage />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/patients/:id/edit" 
          element={
            <PrivateRoute>
              <EditPatientPage />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/beds" 
          element={
            <PrivateRoute>
              <Beds />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/appointments" 
          element={
            <PrivateRoute>
              <AppointmentsPage />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/dispatch" 
          element={
            <PrivateRoute>
              <DispatchDashboard />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/vitals" 
          element={
            <PrivateRoute>
              <VitalsMonitorPage />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/incidents" 
          element={
            <PrivateRoute>
              <IncidentsPage />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/staff" 
          element={
            <PrivateRoute>
              <StaffDirectoryPage />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <PrivateRoute>
              <SettingsPage />
            </PrivateRoute>
          } 
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}

export default App;