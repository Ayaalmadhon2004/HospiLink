// frontend/src/pages/StaffDirectoryPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { Users, RefreshCw, Search, Filter } from 'lucide-react';
import { getStaff, getShiftTimeline } from '../services/staffService';
import { StaffCard } from '../components/Staff/StaffCard';
import { ShiftTimeline } from '../components/Staff/ShiftTimeline';
import { useStaffSocket } from '../hooks/useStaffSocket';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar?: string;
  phone?: string;
  isActive: boolean;
  shifts?: any[];
}

export const StaffDirectoryPage = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [timeline, setTimeline] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const latestShift = useStaffSocket(selectedDept || 'all');

  // Fetch staff list
  const fetchStaff = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await getStaff({ department: selectedDept || undefined });
      setStaff(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch staff:', err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [selectedDept]);

  // Fetch shift timeline
  const fetchTimeline = useCallback(async () => {
    try {
      const res = await getShiftTimeline();
      setTimeline(res.data?.data || {});
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
    fetchTimeline();
  }, [fetchStaff, fetchTimeline]);

  // Real-time shift updates
  useEffect(() => {
    if (latestShift) {
      fetchTimeline(); // Refresh timeline on shift update
    }
  }, [latestShift, fetchTimeline]);

  const departments = [...new Set(staff.map((s) => s.department))];

  const filteredStaff = staff.filter((s) => {
    const matchesDept = !selectedDept || s.department === selectedDept;
    const matchesSearch = 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.role.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-clinic-bg">
        <div className="animate-pulse text-clinic-text/50">Loading staff directory...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-clinic-bg p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-hospital-navy flex items-center gap-2">
            <Users size={28} className="text-medical-teal" />
            Staff & Shifts
          </h1>
          <p className="text-clinic-text/50 text-sm">Staff directory and shift management</p>
        </div>
        <button
          onClick={() => { fetchStaff(); fetchTimeline(); }}
          className="flex items-center gap-2 bg-white text-clinic-text px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition shadow-sm"
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Shift Timeline */}
      <div className="mb-6">
        <ShiftTimeline timeline={timeline} />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clinic-text/40" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none"
            />
          </div>
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clinic-text/40" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="pl-10 pr-8 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-medical-teal outline-none bg-white appearance-none"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStaff.map((member) => (
          <StaffCard key={member.id} member={member} />
        ))}
      </div>

      {filteredStaff.length === 0 && (
        <div className="text-center py-20 text-clinic-text/40">
          <Users size={48} className="mx-auto mb-4 opacity-50" />
          <p>No staff members found</p>
        </div>
      )}
    </div>
  );
};