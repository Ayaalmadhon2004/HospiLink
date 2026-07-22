import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import { PrivateRoute } from './components/PrivateRoute';
import { SignupPage } from './pages/SignupPage';
import { PatientsPage } from './pages/PatientsPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { EditPatientPage } from './pages/EditPatientPage';
import Beds from './pages/Beds';
import { VitalsMonitorPage } from './pages/VitalsMonitorPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import DispatchDashboard from './pages/DispatchDashboard';
import { IncidentsPage } from './pages/IncidentsPage';
import { StaffDirectoryPage } from './pages/StaffDirectoryPage';
import SettingsPage  from './pages/SettingsPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

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
  );
}

export default App;