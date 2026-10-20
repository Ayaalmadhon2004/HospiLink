// frontend/src/pages/Dispatch/DispatchDashboard.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatchSocket } from '../hooks/useDispatchSocket';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../services/api';
import type { ApiResponse } from '../types/api';
import { AlertCircle, X } from 'lucide-react';

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

interface Toast {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'success';
}

const DispatchDashboard: React.FC = () => {
  const { t } = useTranslation();
  const {
    isConnected,
    latestUnitUpdate,
    criticalAlert,
  } = useDispatchSocket();

  const [units, setUnits] = useState<DispatchUnit[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const { data: unitsData } = useQuery({
    queryKey: ['dispatch-units'],
    queryFn: async () => {
      const res = await apiGet<ApiResponse<DispatchUnit[]>>('/dispatch/units/active');
      return res?.data || [];
    },
    refetchInterval: 30000
  });

  // Toast helper
  const showToast = useCallback((message: string, type: 'error' | 'warning' | 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(item => item.id !== id));
    }, 8000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(item => item.id !== id));
  }, []);

  // Update from useQuery
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- effect intentionally syncs/fetches into state (data load or reset on prop change); restructuring would change behaviour
    if (unitsData) setUnits(unitsData);
  }, [unitsData]);

  // Update from socket
  useEffect(() => {
    if (latestUnitUpdate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- effect intentionally syncs/fetches into state (data load or reset on prop change); restructuring would change behaviour
      setUnits(prev => prev.map(u => 
        u.id === latestUnitUpdate.unitId 
          ? { ...u, status: latestUnitUpdate.status, eta: latestUnitUpdate.eta }
          : u
      ));
    }
  }, [latestUnitUpdate]);

  // Critical alert - show toast instead of alert()
  useEffect(() => {
    if (criticalAlert) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- effect intentionally syncs/fetches into state (data load or reset on prop change); restructuring would change behaviour
      showToast(`🚨 ${criticalAlert.message}`, 'warning');
    }
  }, [criticalAlert, showToast]);

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
      {/* Toast Notifications */}
      <div 
        className="fixed top-4 end-4 z-50 space-y-2"
        role="region"
        aria-label={t('common.notifications')}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg transition-all ${
              toast.type === 'warning' 
                ? 'bg-amber-50 border border-amber-200 text-amber-700' 
                : toast.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-green-50 border border-green-200 text-green-700'
            }`}
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle size={18} aria-hidden="true" />
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ms-2 text-current opacity-50 hover:opacity-100"
              aria-label={t('dispatch.dismiss')}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">{t('dispatch.title')}</h1>
        <div 
          className={`flex items-center gap-2 px-3 py-1 rounded-full ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
          role="status"
          aria-label={t('dispatch.connectionStatus', { status: isConnected ? t('dispatch.liveFeed') : t('dispatch.disconnected') })}
        >
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} aria-hidden="true"></span>
          {isConnected ? t('dispatch.liveFeed') : t('dispatch.disconnected')}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title={t('dispatch.stats.active')} value={stats.active} />
        <StatCard title={t('dispatch.stats.enRoute')} value={stats.enRoute} />
        <StatCard title={t('dispatch.stats.onScene')} value={stats.onScene} />
        <StatCard title={t('dispatch.stats.available')} value={stats.available} />
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{t('dispatch.activeUnits')}</h2>
            <p className="text-sm text-gray-500">{t('dispatch.fleetCoordination')}</p>
          </div>
          <span className="text-sm text-teal-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" aria-hidden="true"></span>
            {t('dispatch.liveFeed')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-start text-gray-500 text-sm border-b">
                <th scope="col" className="pb-3 font-medium text-start">{t('dispatch.columns.unit')}</th>
                <th scope="col" className="pb-3 font-medium text-start">{t('dispatch.columns.call')}</th>
                <th scope="col" className="pb-3 font-medium text-start">{t('dispatch.columns.destination')}</th>
                <th scope="col" className="pb-3 font-medium text-start">{t('dispatch.columns.crew')}</th>
                <th scope="col" className="pb-3 font-medium text-start">{t('dispatch.columns.eta')}</th>
                <th scope="col" className="pb-3 font-medium text-start">{t('dispatch.columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {units.map(unit => (
                <tr key={unit.id} className="border-b last:border-0 hover:bg-gray-50 transition">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center" aria-hidden="true">
                        🚑
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{unit.unitCode}</p>
                        <p className="text-xs text-gray-500">{t(`dispatch.unitTypes.${unit.unitType}`, { defaultValue: unit.unitType })}</p>
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
                    <p className="text-gray-700">{unit.crew.join(t('common.listSeparator'))}</p>
                  </td>
                  <td className="py-4">
                    <p className="text-gray-700">{unit.eta ? t('dispatch.etaMinutes', { count: unit.eta }) : '—'}</p>
                  </td>
                  <td className="py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(unit.status)}`}>
                      <span className="me-1" aria-hidden="true">●</span>
                      {t(`dispatch.status.${unit.status}`, { defaultValue: unit.status.replace('_', ' ') })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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