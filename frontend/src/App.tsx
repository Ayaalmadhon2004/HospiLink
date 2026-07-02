import { Routes, Route, Navigate } from 'react-router-dom';  // ← Removed Router import
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import PrivateRoute from './components/PrivateRoute';
import { SignupPage } from './pages/SignupPage';
import { PatientsPage } from './pages/PatientsPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { EditPatientPage } from './pages/EditPatientPage';
import Beds from './pages/Beds';
import { VitalsMonitorPage } from './pages/VitalsMonitorPage';

function App() {
  return (
    <Routes>  {/* ← Removed <Router> wrapper */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      
      <Route 
        path="/dashboard" 
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } 
      />

      <Route path="/patients" element={<PatientsPage />} />
      <Route path="/patients/:id" element={<PatientDetailPage />} />
      <Route path="/patients/:id/edit" element={<EditPatientPage />} />
      <Route path="/beds" element={<Beds />} />  

      <Route path="/vitals" element={
        <VitalsMonitorPage />
    } />

    </Routes>
  );
}

export default App;