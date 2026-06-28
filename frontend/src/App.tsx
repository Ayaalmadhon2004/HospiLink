import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard'; 
import PrivateRoute from './components/PrivateRoute';
import { SignupPage } from "./pages/SignupPage";
import { PatientsPage } from "./pages/PatientsPage";

function App() {
  return (
    <Router>
      <Routes>
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
        
      </Routes>
    </Router>
  );
}

export default App
