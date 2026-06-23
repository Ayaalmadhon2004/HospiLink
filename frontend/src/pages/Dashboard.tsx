import Sidebar from '../components/Dashboard/Sidebar';
import StatCard from '../components/Dashboard/StatCard';
import RecentPatientsTable from '../components/RecentPatientsTable';

const Dashboard = () => {
  return (
    <div className="flex w-full h-screen overflow-hidden bg-[var(--clinic-bg)]">
      
      <div className="flex-shrink-0">
        <Sidebar />
      </div>
      
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--hospital-navy)]">Operations Overview</h1>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Active Patients" value="1,284" />
          <StatCard title="Bed Occupancy" value="82%" />
          <StatCard title="Avg. Wait Time" value="18m" />
          <StatCard title="Staff On Duty" value="346" />
        </div>

        <RecentPatientsTable/>

      </main>
    </div>
  );
};

export default Dashboard;