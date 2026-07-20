import { 
  useState, 
  useEffect, 
  useCallback, 
  useMemo, 
  lazy, 
  Suspense,
  memo 
} from 'react';
import Sidebar from '../components/Dashboard/Sidebar';
import StatCard from '../components/Dashboard/StatCard';
import { getRecentPatients } from '../services/patientService';
import { getTodaySchedule } from '../services/appointmentsService';
import { getStaff } from '../services/staffService';
import { getBeds } from '../services/bedService';
import { DepartmentBar } from '../components/Dashboard/DepartmentBar';

// ─── Code Splitting للصفحات الفرعية ───────────────────────────────
// نستخدم dynamic import مع default export
const PatientsPage = lazy(() => import('../pages/PatientsPage').then(m => ({ default: m.PatientsPage })));
const Beds = lazy(() => import('../pages/Beds'));
const VitalsMonitorPage = lazy(() => import('../pages/VitalsMonitorPage').then(m => ({ default: m.VitalsMonitorPage })));
const StaffDirectoryPage = lazy(() => import('../pages/StaffDirectoryPage').then(m => ({ default: m.StaffDirectoryPage })));
const AppointmentsPage = lazy(() => import('../pages/AppointmentsPage').then(m => ({ default: m.AppointmentsPage })));
const IncidentsPage = lazy(() => import('./IncidentsPage').then(m => ({ default: m.IncidentsPage })));
const DispatchDashboard = lazy(() => import('./DispatchDashboard'));
const SettingsPage = lazy(() => import('./SettingsPage'));

// ─── Cookie Helpers ───────────────────────────────────────────────
const getCookie = (name: string): string => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : '';
};

const setCookie = (name: string, value: string, days = 7): void => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
};

const VALID_TABS = [
  'Overview', 'Patients', 'Beds & Wards', 'Staff & Shifts',
  'Vitals Monitor', 'Appointments', 'Incidents', 'Dispatch', 'Settings'
] as const;

type TabName = typeof VALID_TABS[number];

// ─── Interfaces ─────────────────────────────────────────────────────
interface Patient {
  id: string;
  name: string;
  department?: string;
}

interface TodayAppointment {
  id: string;
  scheduledAt: string;
  type: 'SURGERY' | 'CONSULTATION' | 'IMAGING' | 'FOLLOW_UP' | string;
  patient: { name: string };
  doctor: { name: string };
  room?: string;
}

interface Bed {
  id: string;
  status: 'OCCUPIED' | 'AVAILABLE' | string;
}

interface StaffMember {
  id: string;
}

interface DepartmentLoad {
  name: string;
  current: number;
  max: number;
  color: string;
}

interface DashboardStats {
  patients: Patient[];
  todaySchedule: TodayAppointment[];
  staffCount: number;
  bedOccupancy: number;
  departmentLoads: DepartmentLoad[];
}

// ─── Constants ──────────────────────────────────────────────────────
const POLLING_INTERVAL = 30000; // 30 seconds
const DEPARTMENT_COLORS: Record<string, string> = {
  Emergency: 'red',
  ICU: 'orange',
  Surgery: 'blue',
  Pediatrics: 'green',
  Maternity: 'purple',
  Cardiology: 'teal',
  General: 'gray',
};

const APPOINTMENT_TYPE_COLORS: Record<string, string> = {
  SURGERY: 'bg-red-50 text-red-700 border-red-200',
  CONSULTATION: 'bg-teal-50 text-teal-700 border-teal-200',
  IMAGING: 'bg-blue-50 text-blue-700 border-blue-200',
  FOLLOW_UP: 'bg-amber-50 text-amber-700 border-amber-200',
};

const APPOINTMENT_TYPE_DOTS: Record<string, string> = {
  SURGERY: 'bg-red-500',
  CONSULTATION: 'bg-teal-500',
  IMAGING: 'bg-blue-500',
  FOLLOW_UP: 'bg-amber-500',
};

// ─── Memoized Sub-Components ────────────────────────────────────────
const LoadingSpinner = memo(() => (
  <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
    <span className="sr-only">Loading dashboard data...</span>
  </div>
));

const ErrorBanner = memo(({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div 
    className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between"
    role="alert"
    aria-live="polite"
  >
    <span className="text-sm font-medium">{message}</span>
    <button
      onClick={onRetry}
      className="text-sm font-semibold underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-2"
      aria-label="Retry loading dashboard data"
    >
      Retry
    </button>
  </div>
));

const EmptyState = memo(({ message }: { message: string }) => (
  <div className="text-center py-6 text-gray-400">
    <p className="text-sm">{message}</p>
  </div>
));

const CrisisDispatchCard = memo(({ onOpen }: { onOpen: () => void }) => (
  <section 
    className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-sm p-6 text-white"
    aria-labelledby="crisis-dispatch-heading"
  >
    <h2 id="crisis-dispatch-heading" className="text-lg font-bold mb-2">Crisis Dispatch</h2>
    <p className="text-blue-100 text-sm mb-4">Emergency response system active</p>
    <button
      onClick={onOpen}
      className="block w-full bg-white/20 hover:bg-white/30 focus:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 text-white py-2 rounded-lg transition text-sm font-medium text-center"
      aria-label="Open dispatch dashboard"
    >
      Open Dispatch
    </button>
  </section>
));

// ─── Custom Hook: Dashboard Data ────────────────────────────────────
const useDashboardData = () => {
  const [data, setData] = useState<DashboardStats>({
    patients: [],
    todaySchedule: [],
    staffCount: 0,
    bedOccupancy: 0,
    departmentLoads: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);

      const [patientsRes, scheduleRes, staffRes, bedsRes] = await Promise.all([
        getRecentPatients(),
        getTodaySchedule(),
        getStaff(),
        getBeds(),
      ]);

      if (signal?.aborted) return;

      const patients: Patient[] = Array.isArray(patientsRes) 
        ? patientsRes 
        : patientsRes?.data || [];
      
      const todaySchedule: TodayAppointment[] = Array.isArray(scheduleRes)
        ? scheduleRes
        : scheduleRes?.data?.appointments || [];
      
      const staff: StaffMember[] = Array.isArray(staffRes) 
        ? staffRes 
        : staffRes?.data || [];
      
      const beds: Bed[] = Array.isArray(bedsRes)
        ? bedsRes
        : bedsRes?.data || [];

      const totalBeds = beds.length;
      const occupiedBeds = beds.filter((b) => b.status === 'OCCUPIED').length;
      const bedOccupancy = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

      // Build department loads
      const deptMap = new Map<string, { current: number; max: number }>();
      
      patients.forEach((p) => {
        const dept = p.department || 'General';
        const existing = deptMap.get(dept) || { current: 0, max: 50 };
        deptMap.set(dept, { ...existing, current: existing.current + 1 });
      });

      const defaultDepts = ['Emergency', 'ICU', 'Surgery', 'Pediatrics', 'Maternity', 'Cardiology', 'General'];
      defaultDepts.forEach((dept) => {
        if (!deptMap.has(dept)) {
          deptMap.set(dept, { current: 0, max: 50 });
        }
      });

      const departmentLoads: DepartmentLoad[] = Array.from(deptMap.entries())
        .map(([name, load]) => ({
          name,
          current: load.current,
          max: load.max,
          color: DEPARTMENT_COLORS[name] || 'gray',
        }))
        .sort((a, b) => b.current - a.current);

      setData({
        patients,
        todaySchedule,
        staffCount: staff.length,
        bedOccupancy,
        departmentLoads,
      });

    } catch (err) {
      if (signal?.aborted) return;
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    const controller = new AbortController();
    
    fetchData(controller.signal);
    
    const interval = setInterval(() => {
      fetchData(controller.signal);
    }, POLLING_INTERVAL);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchData]);

  return { ...data, loading, error, refetch: fetchData };
};

// ─── Main Component ─────────────────────────────────────────────────
const Dashboard = () => {
  const [activeItem, setActiveItem] = useState<TabName>(() => {
    const saved = getCookie('dashboard_active_tab');
    return VALID_TABS.includes(saved as TabName) ? (saved as TabName) : 'Overview';
  });

  const {
    patients,
    todaySchedule,
    staffCount,
    bedOccupancy,
    departmentLoads,
    loading,
    error,
    refetch,
  } = useDashboardData();

  // Persist active tab
  useEffect(() => {
    setCookie('dashboard_active_tab', activeItem);
  }, [activeItem]);

  // ─── Memoized Helpers ─────────────────────────────────────────────
  const formatTime = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }, []);

  const getTypeColor = useCallback((type: string) => {
    return APPOINTMENT_TYPE_COLORS[type] || 'bg-gray-50 text-gray-700';
  }, []);

  const getTypeDot = useCallback((type: string) => {
    return APPOINTMENT_TYPE_DOTS[type] || 'bg-gray-400';
  }, []);

  // ─── SEO: Document Title ──────────────────────────────────────────
  useEffect(() => {
    document.title = `${activeItem} | Muraqib Hospital Dashboard`;
  }, [activeItem]);

  // ─── Handle Sidebar Click ─────────────────────────────────────────
  const handleItemClick = useCallback((item: string) => {
    if (VALID_TABS.includes(item as TabName)) {
      setActiveItem(item as TabName);
    }
  }, []);

  // ─── Render Content ───────────────────────────────────────────────
  const renderContent = useMemo(() => {
    switch (activeItem) {
      case 'Patients':
        return <PatientsPage />;
      case 'Beds & Wards':
        return <Beds />;
      case 'Staff & Shifts':
        return <StaffDirectoryPage />;
      case 'Vitals Monitor':
        return <VitalsMonitorPage />;
      case 'Appointments':
        return <AppointmentsPage />;
      case 'Incidents':
        return <IncidentsPage />;
      case 'Dispatch':
        return <DispatchDashboard />;
      case 'Settings':
        return <SettingsPage />;
      case 'Overview':
      default:
        return null;
    }
  }, [activeItem]);

  // ─── Overview Panel ───────────────────────────────────────────────
  const OverviewPanel = useMemo(() => (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operations Overview</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time hospital metrics and activity</p>
        </div>
      </header>

      {/* Error Banner */}
      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {/* Stats Grid */}
      <section 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        aria-label="Key statistics"
      >
        <StatCard 
          title="Active Patients" 
          value={patients.length.toString()} 
          trend="+12%" 
          trendUp={true}
          icon="users"
        />
        <StatCard 
          title="Bed Occupancy" 
          value={`${bedOccupancy}%`} 
          trend={`${bedOccupancy > 80 ? '+' : '-'}${Math.abs(bedOccupancy - 75)}%`} 
          trendUp={bedOccupancy > 75}
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
          value={loading ? '...' : staffCount.toString()} 
          trend="-2" 
          trendUp={false}
          icon="staff"
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Load */}
        <section 
          className="lg:col-span-2 bg-white rounded-xl shadow-sm border p-6"
          aria-labelledby="dept-load-heading"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 id="dept-load-heading" className="text-lg font-bold text-gray-900">Department Load</h2>
          </div>
          <div className="space-y-4">
            {loading ? (
              <LoadingSpinner />
            ) : departmentLoads.length > 0 ? (
              departmentLoads.map((dept) => (
                <DepartmentBar 
                  key={dept.name} 
                  title={dept.name} 
                  current={dept.current} 
                  max={dept.max} 
                  color={dept.color} 
                />
              ))
            ) : (
              <EmptyState message="No active departments" />
            )}
          </div>
        </section>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Today's Schedule */}
          <section 
            className="bg-white rounded-xl shadow-sm border p-6"
            aria-labelledby="schedule-heading"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 id="schedule-heading" className="text-lg font-bold text-gray-900">Today's Schedule</h2>
              <button 
                onClick={() => setActiveItem('Appointments')}
                className="text-teal-600 text-sm hover:underline focus:outline-none focus:ring-2 focus:ring-teal-500 rounded px-1"
                aria-label="View all appointments"
              >
                View All
              </button>
            </div>

            {loading ? (
              <LoadingSpinner />
            ) : todaySchedule.length > 0 ? (
              <ul className="space-y-3" role="list" aria-label="Today's appointments">
                {todaySchedule.slice(0, 5).map((apt) => (
                  <li 
                    key={apt.id} 
                    className={`flex items-center gap-3 p-3 rounded-lg border-l-4 ${getTypeColor(apt.type)}`}
                  >
                    <div className="flex-shrink-0">
                      <span className={`w-2 h-2 rounded-full ${getTypeDot(apt.type)} block`} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {apt.patient?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {apt.type} · Dr. {apt.doctor?.name || 'Unknown'}
                        {apt.room && ` · ${apt.room}`}
                      </p>
                    </div>
                    <time 
                      className="text-xs font-medium text-gray-600 whitespace-nowrap"
                      dateTime={apt.scheduledAt}
                    >
                      {formatTime(apt.scheduledAt)}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="No appointments today" />
            )}
          </section>

          {/* Crisis Dispatch */}
          <CrisisDispatchCard onOpen={() => setActiveItem('Dispatch')} />
        </div>
      </div>
    </div>
  ), [
    patients.length, 
    bedOccupancy, 
    staffCount, 
    loading, 
    error, 
    departmentLoads, 
    todaySchedule, 
    refetch,
    formatTime,
    getTypeColor,
    getTypeDot
  ]);

  return (
    <div className="flex w-full h-screen overflow-hidden bg-gray-50">
      <div className="flex-shrink-0">
        <Sidebar 
          activeItem={activeItem} 
          onItemClick={handleItemClick} 
        />
      </div>

      <main 
        className="flex-1 overflow-y-auto p-8"
        role="main"
        aria-label={`${activeItem} dashboard`}
      >
        {activeItem === 'Overview' ? (
          OverviewPanel
        ) : (
          <Suspense fallback={<LoadingSpinner />}>
            {renderContent}
          </Suspense>
        )}
      </main>
    </div>
  );
};

export default memo(Dashboard);