import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Users, MapPin, Clock, Plus, Search, Filter, Activity } from 'lucide-react';
import {  getIncidents, updateIncidentStatus } from '../services/incidentsService';
import { useIncidentsSocket } from '../hooks/useIncidentsSocket';

interface Incident {
  id: string;
  code: string;
  title: string;
  description?: string;
  type: string;
  severity: 'CRITICAL' | 'ELEVATED' | 'MODERATE' | 'LOW';
  status: string;
  location: string;
  teams: number;
  progress: number;
  triageLevel?: string;
  createdAt: string;
}

const severityColors = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  ELEVATED: 'bg-amber-100 text-amber-700 border-amber-200',
  MODERATE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  LOW: 'bg-green-100 text-green-700 border-green-200',
};

const severityDots = {
  CRITICAL: 'bg-red-500',
  ELEVATED: 'bg-amber-500',
  MODERATE: 'bg-yellow-500',
  LOW: 'bg-green-500',
};

export const IncidentsPage = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  const latestUpdate = useIncidentsSocket();

  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getIncidents(); 
      setIncidents(res?.data || []); 
    } catch (err) {
      console.error('Failed to fetch incidents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  useEffect(() => {
    if (latestUpdate) fetchIncidents();
  }, [latestUpdate, fetchIncidents]);

  const handleProgressUpdate = async (id: string, newProgress: number) => {
    try {
      await updateIncidentStatus(id, 'ACTIVE', newProgress);
    } catch (err) {
      console.error('Failed to update progress:', err);
    }
  };

  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch = 
      inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = !filterSeverity || inc.severity === filterSeverity;
    return matchesSearch && matchesSeverity;
  });

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Loading incidents...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={28} className="text-red-500" />
            Incidents
          </h1>
          <p className="text-gray-500 text-sm">Active emergency response</p>
        </div>
        <button className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition">
          <Plus size={16} />
          Report Incident
        </button>
      </div>

      {/* Code Orange Alert */}
      {incidents.some(i => i.severity === 'CRITICAL') && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <div className="flex-1">
            <p className="font-semibold text-red-700">Code Orange Active — Mass Casualty Protocol Engaged</p>
          </div>
          <span className="text-sm text-red-600">Regional command linked</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search incidents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white"
        >
          <option value="">All Severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="ELEVATED">Elevated</option>
          <option value="MODERATE">Moderate</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      {/* Incidents List */}
      <div className="space-y-4">
        {filteredIncidents.length > 0 ? (
          filteredIncidents.map((incident) => (
            <div key={incident.id} className="bg-white rounded-xl shadow-sm border p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 font-mono">{incident.code}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${severityColors[incident.severity]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${severityDots[incident.severity]} inline-block mr-1`} />
                    {incident.severity}
                  </span>
                </div>
                <span className="text-sm text-gray-400">{timeAgo(incident.createdAt)}</span>
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-gray-900 mb-2">{incident.title}</h3>

              {/* Meta */}
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <span className="flex items-center gap-1">
                  <MapPin size={14} />
                  {incident.location}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {incident.teams} teams
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {timeAgo(incident.createdAt)}
                </span>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Triage progress</span>
                  <span className="font-semibold text-gray-900">{incident.progress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      incident.progress >= 75 ? 'bg-green-500' :
                      incident.progress >= 50 ? 'bg-amber-500' :
                      incident.progress >= 25 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${incident.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 text-gray-400">
            <Activity size={48} className="mx-auto mb-4 opacity-50" />
            <p>No active incidents</p>
          </div>
        )}
      </div>
    </div>
  );
};