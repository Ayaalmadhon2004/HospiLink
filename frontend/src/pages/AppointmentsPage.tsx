import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, User, Stethoscope, MapPin, Plus, Search, Filter } from 'lucide-react';
import { getTodaySchedule, getUpcomingAppointments, getAppointments } from '../services/appointmentsService';
import { useAppointmentsSocket } from '../hooks/useAppointmentsSocket';
import { NewAppointmentModal } from '../components/Appointments/NewAppointmentModal';

interface Appointment {
  id: string;
  scheduledAt: string;
  type: string;
  status: string;
  department: string;
  room?: string;
  duration: number;
  patient: {
    id: string;
    name: string;
    patientCode: string;
  };
  doctor: {
    id: string;
    name: string;
    role: string;
  };
}

const typeColors: Record<string, string> = {
  SURGERY: 'bg-red-100 text-red-700 border-red-200',
  CONSULTATION: 'bg-teal-100 text-teal-700 border-teal-200',
  IMAGING: 'bg-blue-100 text-blue-700 border-blue-200',
  FOLLOW_UP: 'bg-amber-100 text-amber-700 border-amber-200',
};

const typeDotColors: Record<string, string> = {
  SURGERY: 'bg-red-500',
  CONSULTATION: 'bg-teal-500',
  IMAGING: 'bg-blue-500',
  FOLLOW_UP: 'bg-amber-500',
};

export const AppointmentsPage = () => {
  const [todaySchedule, setTodaySchedule] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const latestUpdate = useAppointmentsSocket();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [todayRes, upcomingRes] = await Promise.all([
        getTodaySchedule(),
        getUpcomingAppointments(),
      ]);

    console.log('🔥 TODAY RES:', todayRes);           // شوفي ده
    console.log('🔥 TODAY RES.data:', todayRes?.data); // شوفي ده
    console.log('🔥 UPCOMING RES:', upcomingRes); 

      setTodaySchedule(todayRes?.data || { appointments: [], schedule: {} });
      setUpcoming(upcomingRes?.data || []);
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (latestUpdate) fetchData();
  }, [latestUpdate, fetchData]);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const filteredUpcoming = upcoming.filter((apt) => {
    const matchesSearch = 
      apt.patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.doctor.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !selectedType || apt.type === selectedType;
    return matchesSearch && matchesType;
  });

  const appointmentTypes = [...new Set(upcoming.map((a) => a.type))];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Loading appointments...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={28} className="text-teal-500" />
            Appointments
          </h1>
          <p className="text-gray-500 text-sm">Daily schedule and bookings</p>
        </div>
        <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition"
          >
            <Plus size={16} />
            New Appointment
          </button>

          <NewAppointmentModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSuccess={fetchData}
          />
      </div>

      {/* Today's Schedule */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Today's Schedule</h2>
        <p className="text-gray-500 text-sm mb-4">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <div className="space-y-3">
          {todaySchedule?.appointments?.length > 0 ? (
            todaySchedule.appointments.map((apt: Appointment) => (
              <div
                key={apt.id}
                className={`flex items-start gap-4 p-4 rounded-lg border-l-4 ${
                  typeColors[apt.type] || 'bg-gray-50 border-gray-300'
                }`}
              >
                <div className="flex flex-col items-center min-w-[60px]">
                  <span className="text-lg font-bold text-gray-900">{formatTime(apt.scheduledAt)}</span>
                  <span className="text-xs text-gray-500">{apt.duration}min</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${typeDotColors[apt.type] || 'bg-gray-400'}`} />
                    <span className="font-medium text-gray-900">{apt.patient.name}</span>
                    <span className="text-xs text-gray-400">{apt.patient.patientCode}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Stethoscope size={14} />
                      {apt.type} · Dr. {apt.doctor.name}
                    </span>
                    {apt.room && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {apt.room}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Clock size={48} className="mx-auto mb-3 opacity-50" />
              <p>No appointments scheduled for today</p>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Appointments */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Upcoming</h2>
          <p className="text-gray-500 text-sm">Next appointments today</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search patients, doctors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
          >
            <option value="">All Types</option>
            {appointmentTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* List */}
        <div className="space-y-3">
          {filteredUpcoming.length > 0 ? (
            filteredUpcoming.map((apt) => (
              <div
                key={apt.id}
                className="flex items-center gap-4 p-4 rounded-lg border hover:bg-gray-50 transition"
              >
                <div className="flex flex-col items-center min-w-[60px] bg-gray-100 rounded-lg p-2">
                  <span className="text-sm font-bold text-gray-900">{formatTime(apt.scheduledAt)}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${typeDotColors[apt.type] || 'bg-gray-400'}`} />
                    <span className="font-medium text-gray-900">{apt.patient.name}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {apt.type} · Dr. {apt.doctor.name} · {apt.department}
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[apt.type] || ''}`}>
                  {apt.type}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Calendar size={48} className="mx-auto mb-3 opacity-50" />
              <p>No upcoming appointments</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};