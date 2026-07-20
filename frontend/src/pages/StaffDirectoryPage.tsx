import { useState, useEffect, useCallback } from 'react';
import { Users, RefreshCw, Search } from 'lucide-react';
import { getStaff, getShiftTimeline } from '../services/staffService';
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
  const [_timeline, setTimeline] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const latestShift = useStaffSocket(selectedDept || 'all');

  const fetchStaff = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await getStaff({ department: selectedDept || undefined });
      const data = res?.data?.data || res?.data || [];
      console.log('Staff API response:', res);
      console.log('Staff data:', data);
      setStaff(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch staff:', err);
      setStaff([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [selectedDept]);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await getShiftTimeline();
      const data = res?.data || {};
      console.log('Timeline API response:', res);
      console.log('Timeline data:', data);
      setTimeline(data);
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
      setTimeline({});
    }
  }, []);

  useEffect(() => {
    fetchStaff();
    fetchTimeline();
  }, [fetchStaff, fetchTimeline]);

  useEffect(() => {
    if (latestShift) fetchTimeline();
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Loading staff directory...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={28} className="text-teal-500" aria-hidden="true" />
            Staff & Shifts
          </h1>
          <p className="text-gray-500 text-sm">Staff directory and shift management</p>
        </div>
        <button
          onClick={() => { fetchStaff(); fetchTimeline(); }}
          className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg border hover:bg-gray-50 transition"
          disabled={refreshing}
          aria-label="Refresh staff directory"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
              aria-label="Search staff by name or role"
              autoComplete="off"
            />
          </div>
          <label htmlFor="dept-filter" className="sr-only">Filter by department</label>
          <select
            id="dept-filter"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
            aria-label="Filter by department"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Staff Table - Grid with ARIA roles for accessibility */}
      <div 
        className="bg-white rounded-xl shadow-sm border overflow-hidden"
        role="table"
        aria-label="Staff directory"
      >
        {/* Header */}
        <div 
          className="grid grid-cols-5 p-4 bg-gray-50 border-b text-sm font-medium text-gray-500"
          role="row"
        >
          <div role="columnheader" aria-colindex={1}>Name</div>
          <div role="columnheader" aria-colindex={2}>Role</div>
          <div role="columnheader" aria-colindex={3}>Department</div>
          <div role="columnheader" aria-colindex={4}>Status</div>
          <div role="columnheader" aria-colindex={5}>Current Shift</div>
        </div>

        {/* Rows */}
        {filteredStaff.map((member) => (
          <div 
            key={member.id} 
            className="grid grid-cols-5 p-4 border-b last:border-b-0 items-center hover:bg-gray-50 transition"
            role="row"
          >
            <div role="cell" className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-bold"
                aria-hidden="true"
              >
                {member.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <div className="font-medium text-gray-900">{member.name}</div>
                <div className="text-xs text-gray-400">{member.email}</div>
              </div>
            </div>
            <div role="cell" className="text-gray-600">{member.role}</div>
            <div role="cell" className="text-gray-600">{member.department}</div>
            <div role="cell">
              <span 
                className={`px-2 py-1 rounded-full text-xs font-medium ${member.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}
                role="status"
                aria-label={`Status: ${member.isActive ? 'Active' : 'Inactive'}`}
              >
                {member.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div role="cell">
              {member.shifts?.[0] ? (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600">
                  {member.shifts[0].type}
                </span>
              ) : (
                <span className="text-gray-400 text-sm">—</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredStaff.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Users size={48} className="mx-auto mb-4 opacity-50" aria-hidden="true" />
          <p>No staff members found</p>
        </div>
      )}
    </div>
  );
};