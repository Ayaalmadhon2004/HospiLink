// frontend/src/pages/Dispatch/DispatchDashboard.tsx
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useDispatchSocket } from '../hooks/useDispatchSocket';
import { useNow } from '../hooks/useNow';
import { apiGet } from '../services/api';
import type { ApiResponse } from '../types/api';
import { useAuthPermissions } from '../hooks/useAuthPermissions';
import UnitActions from '../components/Dashboard/UnitActions';
import {
  computeUnitStats,
  getStatusStyle,
  getUnitAlarm,
  type DispatchUnit,
} from '../utils/dispatchUnits';
import { enumLabel } from '../utils/enumLabel';

const POLL_INTERVAL_MS = 10_000;
const CLOCK_TICK_MS = 30_000;
const ALERT_TOAST_MS = 8_000;
const UNITS_KEY = ['dispatch-units'] as const;

const DispatchDashboard: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isConnected, latestUnitUpdate, criticalAlert } = useDispatchSocket();
  // Re-evaluates time-based alarms (prolonged on-scene, delayed) between polls
  const now = useNow(CLOCK_TICK_MS);
  const canDispatch = useAuthPermissions().can('dispatch:operate');

  const { data: units = [] } = useQuery({
    queryKey: UNITS_KEY,
    queryFn: async () => {
      const res = await apiGet<ApiResponse<DispatchUnit[]>>('/dispatch/units/active');
      return res?.data || [];
    },
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  // A live status update patches the cached unit until the next poll confirms it.
  useEffect(() => {
    if (!latestUnitUpdate) return;
    queryClient.setQueryData<DispatchUnit[]>(UNITS_KEY, (current) =>
      current?.map((unit) =>
        unit.id === latestUnitUpdate.unitId
          ? { ...unit, status: latestUnitUpdate.status, eta: latestUnitUpdate.eta }
          : unit,
      ),
    );
  }, [latestUnitUpdate, queryClient]);

  useEffect(() => {
    if (criticalAlert) toast.warning(`🚨 ${criticalAlert.message}`, { duration: ALERT_TOAST_MS });
  }, [criticalAlert]);

  const stats = useMemo(() => computeUnitStats(units, now), [units, now]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">

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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard title={t('dispatch.stats.active')} value={stats.active} />
        <StatCard title={t('dispatch.stats.enRoute')} value={stats.enRoute} />
        <StatCard title={t('dispatch.stats.onScene')} value={stats.onScene} />
        <StatCard title={t('dispatch.stats.available')} value={stats.available} />
        <StatCard title={t('dispatch.stats.alarms')} value={stats.alarms} alarm={stats.alarms > 0} />
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
                {canDispatch && (
                  <th scope="col" className="pb-3 font-medium text-end">
                    <span className="sr-only">{t('dispatch.columns.actions')}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {units.map(unit => {
                const alarm = getUnitAlarm(unit, now);
                const style = getStatusStyle(unit.status);
                return (
                <tr key={unit.id} className={`border-b last:border-0 transition ${alarm ? 'bg-red-50/40' : 'hover:bg-gray-50'}`}>
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center" aria-hidden="true">
                        🚑
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{unit.unitCode}</p>
                        <p className="text-xs text-gray-500">{enumLabel(t, 'unitType', unit.unitType)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4">
                    <p className="text-gray-700">{unit.currentCall?.type ?? t('dispatch.noCall')}</p>
                  </td>
                  <td className="py-4">
                    <p className="text-gray-700">{unit.currentCall?.location ?? t('dispatch.noCall')}</p>
                  </td>
                  <td className="py-4">
                    <p className="text-gray-700">{unit.crew.map((member) => member.name).join(t('common.listSeparator'))}</p>
                  </td>
                  <td className="py-4">
                    <p className="text-gray-700">{unit.eta ? t('dispatch.etaMinutes', { count: unit.eta }) : t('dispatch.noCall')}</p>
                  </td>
                  <td className="py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-3 py-1 rounded-full border text-xs font-medium ${style.badge}`}>
                        <span className="me-1" aria-hidden="true">●</span>
                        {t(`dispatch.status.${unit.status}`, { defaultValue: unit.status.replace('_', ' ') })}
                      </span>
                      {alarm && (
                        <span
                          role="status"
                          className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold ring-2 ring-red-300 animate-pulse"
                        >
                          {t(`dispatch.alarms.${alarm}`)}
                        </span>
                      )}
                    </div>
                  </td>
                  {canDispatch && (
                    <td className="py-4 text-end">
                      <UnitActions unit={unit} />
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: number; alarm?: boolean }> = ({ title, value, alarm }) => (
  <div className={`rounded-xl shadow-sm p-6 ${alarm ? 'bg-red-50 ring-2 ring-red-300 animate-pulse' : 'bg-white'}`}>
    <p className="text-sm text-gray-500 mb-2">{title}</p>
    <p className={`text-3xl font-bold ${alarm ? 'text-red-700' : 'text-gray-800'}`}>{value}</p>
  </div>
);

export default DispatchDashboard;