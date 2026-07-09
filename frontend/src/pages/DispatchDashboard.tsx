// frontend/src/pages/Dispatch/DispatchDashboard.tsx
import React, { useEffect, useState } from 'react';
import { useDispatchSocket } from '../hooks/useDispatchSocket';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../services/api'; // ← استخدمي apiGet

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'; // ← Fallback

interface DispatchUnit {
  id: string;
  unitCode: string;
  unitType: string;
  status: string;
  currentCall?: string;
  destination?: string;
  crew: string[];
  eta?: number;
}

const DispatchDashboard: React.FC = () => {
  const {
    isConnected,
    latestUnitUpdate,
    latestCall,
    criticalAlert,
    joinDepartment
  } = useDispatchSocket();

  const [units, setUnits] = useState<DispatchUnit[]>([]);

  // ✅ استخدمي apiGet
  const { data: unitsData } = useQuery({
    queryKey: ['dispatch-units'],
    queryFn: async () => {
      const res = await apiGet('/dispatch/units/active');
      return res?.data || []; // ← return array مش undefined
    },
    refetchInterval: 30000
  });

  useEffect(() => {
    if (unitsData) setUnits(unitsData);
  }, [unitsData]);

  // تحديث فوري من السوكيت
  useEffect(() => {
    if (latestUnitUpdate) {
      setUnits(prev => prev.map(u => 
        u.id === latestUnitUpdate.unitId 
          ? { ...u, status: latestUnitUpdate.status, eta: latestUnitUpdate.eta }
          : u
      ));
    }
  }, [latestUnitUpdate]);

  // تنبيه حرج
  useEffect(() => {
    if (criticalAlert) {
      alert(`🚨 ${criticalAlert.message}`);
    }
  }, [criticalAlert]);

  // إحصائيات
  const stats = {
    active: units.filter(u => u.status !== 'OFF_DUTY').length,
    enRoute: units.filter(u => u.status === 'EN_ROUTE').length,
    onScene: units.filter(u => u.status === 'ON_SCENE').length,
    available: units.filter(u => u.status === 'AVAILABLE').length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'EN_ROUTE': return 'bg-blue-100 text-blue-800';
      case 'ON_SCENE': return 'bg-red-100 text-red-800';
      case 'AVAILABLE': return 'bg-green-100 text-green-800';
      case 'TRANSPORTING': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Dispatch</h1>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          {isConnected ? 'Live feed' : 'Disconnected'}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard title="Units Active" value={stats.active} />
        <StatCard title="En Route" value={stats.enRoute} />
        <StatCard title="On Scene" value={stats.onScene} />
        <StatCard title="Available" value={stats.available} />
      </div>

      {/* Active Units Table */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Active Units</h2>
            <p className="text-sm text-gray-500">Live fleet coordination</p>
          </div>
          <span className="text-sm text-teal-600 flex items-center gap-1">
            🔊 Live feed
          </span>
        </div>

        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-500 text-sm border-b">
              <th className="pb-3 font-medium">UNIT</th>
              <th className="pb-3 font-medium">CALL</th>
              <th className="pb-3 font-medium">DESTINATION</th>
              <th className="pb-3 font-medium">CREW</th>
              <th className="pb-3 font-medium">ETA</th>
              <th className="pb-3 font-medium">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {units.map(unit => (
              <tr key={unit.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      🚑
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{unit.unitCode}</p>
                      <p className="text-xs text-gray-500">{unit.unitType}</p>
                    </div>
                  </div>
                </td>
                <td className="py-4">
                  <p className="text-gray-700">{unit.currentCall || '—'}</p>
                </td>
                <td className="py-4">
                  <p className="text-gray-700">{unit.destination || '—'}</p>
                </td>
                <td className="py-4">
                  <p className="text-gray-700">{unit.crew.join(', ')}</p>
                </td>
                <td className="py-4">
                  <p className="text-gray-700">{unit.eta ? `${unit.eta} min` : '—'}</p>
                </td>
                <td className="py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(unit.status)}`}>
                    ● {unit.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: number }> = ({ title, value }) => (
  <div className="bg-white rounded-xl shadow-sm p-6">
    <p className="text-sm text-gray-500 mb-2">{title}</p>
    <p className="text-3xl font-bold text-gray-800">{value}</p>
  </div>
);

export default DispatchDashboard;