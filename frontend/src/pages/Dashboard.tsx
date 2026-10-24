import { useTranslation } from 'react-i18next';
import StatCard from '../components/Dashboard/StatCard';
import { PatientFlowSection } from '../components/Dashboard/PatientFlowSection';
import { BedOccupancyCard } from '../components/Dashboard/Overview/BedOccupancyCard';
import { CrisisDispatchCard } from '../components/Dashboard/Overview/CrisisDispatchCard';
import { DepartmentLoadSection } from '../components/Dashboard/Overview/DepartmentLoadSection';
import { ErrorBanner } from '../components/Dashboard/Overview/StatusBlocks';
import { TodayScheduleSection } from '../components/Dashboard/Overview/TodayScheduleSection';
import { useAuth } from '../contexts/authContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { formatDate } from '../utils/datetime';
import { getGreetingKey } from '../utils/dashboardStats';

/**
 * Overview section (route `/dashboard`). The frame and the navigation live in AppLayout; the other sections
 * are their own routes in App.tsx.
 */
const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const data = useDashboardData();
  const { loading } = data;

  const now = new Date();
  const greeting = t(getGreetingKey(now));
  const firstName = user?.name?.replace(/^dr\.?\s+/i, '').split(' ')[0] ?? '';
  const count = (value: number): string => (loading ? '...' : String(value));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-gray-500">{formatDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="text-2xl font-semibold text-gray-900 mt-1">
          {firstName ? t('dashboard.greetingWithName', { greeting, name: firstName }) : greeting}
        </h1>
      </header>

      {data.error && <ErrorBanner message={t(data.error)} onRetry={() => void data.refetch()} />}

      {/* Bed occupancy leads, the rest support it */}
      <section className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-4" aria-label={t('dashboard.keyStats')}>
        <BedOccupancyCard loading={loading} percent={data.bedOccupancy} occupied={data.occupiedBeds} total={data.totalBeds} />
        <StatCard title={t('dashboard.patients')} value={count(data.patients.length)} hint={t('dashboard.patientsHint')} />
        <StatCard title={t('dashboard.appointments')} value={count(data.todaySchedule.length)} hint={t('dashboard.appointmentsHint')} />
        <StatCard title={t('dashboard.staff')} value={count(data.staffCount)} hint={t('dashboard.staffHint')} />
      </section>

      <PatientFlowSection />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DepartmentLoadSection loading={loading} loads={data.departmentLoads} />
        <div className="space-y-4">
          <TodayScheduleSection loading={loading} appointments={data.todaySchedule} />
          <CrisisDispatchCard />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
