import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Dashboard/Sidebar';
import StatCard from '../components/Dashboard/StatCard';
import RecentPatientsTable from '../components/Dashboard/RecentPatientsTable';
import { AdmitPatientModal } from '../components/Dashboard/AdmitPatientModal';
import { getRecentPatients } from '../services/patientService';
import { DepartmentBar } from '../components/Dashboard/DepartmentBar';
import { PatientsPage } from '../pages/PatientsPage'; // ← NEW

const Dashboard = () => {
  const [activeItem, setActiveItem] = useState('Overview'); // ← NEW
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);

  const fetchRecentPatients = useCallback(async () => {
    try {
      const data = await getRecentPatients();
      setPatients(data);
    } catch (err) {
      console.error("Error fetching patients:", err);
    }
  }, []);

  useEffect(() => {
    fetchRecentPatients();
  }, [fetchRecentPatients]);

  // ← NEW: render content based on active item
  const renderContent = () => {
    switch (activeItem) {
      case 'Patients':
        return <PatientsPage />;
      case 'Overview':
      default:
        return (
          <>
            <header className="mb-8 flex justify-between items-center">
              <h1 className="text-2xl font-bold text-[var(--hospital-navy)]">Operations Overview</h1>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              >
                + Admit Patient
              </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard title="Active Patients" value="1,284" />
              <StatCard title="Bed Occupancy" value="82%" />
              <StatCard title="Avg. Wait Time" value="18m" />
              <StatCard title="Staff On Duty" value="346" />
            </div>

            <AdmitPatientModal 
              isOpen={isModalOpen} 
              onClose={() => setIsModalOpen(false)} 
              onAdd={fetchRecentPatients} 
            />

            <div className="bg-white p-6 rounded-xl shadow-sm mb-8">
              <h2 className="text-lg font-bold mb-4">Department Load</h2>
              <DepartmentBar title="Emergency" current={46} max={50} />
              <DepartmentBar title="ICU" current={39} max={50} />
              <DepartmentBar title="Surgery" current={32} max={50} />
              <DepartmentBar title="Pediatrics" current={24} max={50} />
            </div>

            <RecentPatientsTable patients={patients} />
          </>
        );
    }
  };

  return (
    <div className="flex w-full h-screen overflow-hidden bg-[var(--clinic-bg)]">
      <div className="flex-shrink-0">
        <Sidebar 
          activeItem={activeItem} 
          onItemClick={setActiveItem} 
        />
      </div>
      
      <main className="flex-1 overflow-y-auto p-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default Dashboard;