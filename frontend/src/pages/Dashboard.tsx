import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Dashboard/Sidebar';
import StatCard from '../components/Dashboard/StatCard';
import RecentPatientsTable from '../components/Dashboard/RecentPatientsTable';
import { AdmitPatientModal } from '../components/Dashboard/AdmitPatientModal';
import { getRecentPatients } from '../services/patientService';
import { DepartmentBar } from '../components/Dashboard/DepartmentBar';
import { PatientsPage } from '../pages/PatientsPage';
import Beds from '../pages/Beds'; // ← NEW

const Dashboard = () => {
  const [activeItem, setActiveItem] = useState('Overview');
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

  const renderContent = () => {
    switch (activeItem) {
      case 'Patients':
        return <PatientsPage />;
      case 'Beds & Wards':    // ← NEW
        return <Beds />;
      case 'Overview':
      default:
        return (
          <div className="space-y-6">
            {/* Header */}
            <header className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Operations Overview</h1>
                <p className="text-gray-500 text-sm mt-1">Real-time hospital metrics and activity</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition flex items-center gap-2 text-sm font-medium"
              >
                <span>+</span> Admit Patient
              </button>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard 
                title="Active Patients" 
                value="1,284" 
                trend="+12%" 
                trendUp={true}
                icon="users"
              />
              <StatCard 
                title="Bed Occupancy" 
                value="82%" 
                trend="+5%" 
                trendUp={true}
                icon="bed"
              />
              <StatCard 
                title="Avg. Wait Time" 
                value="18m" 
                trend="-3m" 
                trendUp={true}
                icon="clock"
              />
              <StatCard 
                title="Staff On Duty" 
                value="346" 
                trend="-2" 
                trendUp={false}
                icon="staff"
              />
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Department Load - 2 columns */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-gray-900">Department Load</h2>
                  <button className="text-blue-600 text-sm hover:underline">View All</button>
                </div>
                <div className="space-y-4">
                  <DepartmentBar title="Emergency" current={46} max={50} color="red" />
                  <DepartmentBar title="ICU" current={39} max={50} color="orange" />
                  <DepartmentBar title="Surgery" current={32} max={50} color="blue" />
                  <DepartmentBar title="Pediatrics" current={24} max={50} color="green" />
                  <DepartmentBar title="Maternity" current={18} max={30} color="purple" />
                  <DepartmentBar title="Cardiology" current={28} max={40} color="teal" />
                </div>
              </div>

              {/* Quick Stats - 1 column */}
              <div className="space-y-4">
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Today's Schedule</h2>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Morning Rounds</p>
                        <p className="text-xs text-gray-500">8:00 AM - 10:00 AM</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Surgery Block</p>
                        <p className="text-xs text-gray-500">10:30 AM - 2:00 PM</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Staff Meeting</p>
                        <p className="text-xs text-gray-500">3:00 PM - 4:00 PM</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-sm p-6 text-white">
                  <h2 className="text-lg font-bold mb-2">Crisis Dispatch</h2>
                  <p className="text-blue-100 text-sm mb-4">Emergency response system active</p>
                  <button className="w-full bg-white/20 hover:bg-white/30 text-white py-2 rounded-lg transition text-sm font-medium">
                    Open Dispatch
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Patients Table */}
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Recent Admissions</h2>
                    <p className="text-gray-500 text-sm">Latest patient admissions and updates</p>
                  </div>
                  <button className="text-blue-600 text-sm hover:underline">View All Patients</button>
                </div>
              </div>
              <RecentPatientsTable patients={patients} />
            </div>

            <AdmitPatientModal 
              isOpen={isModalOpen} 
              onClose={() => setIsModalOpen(false)} 
              onAdd={fetchRecentPatients} 
            />
          </div>
        );
    }
  };

  return (
    <div className="flex w-full h-screen overflow-hidden bg-gray-50">
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