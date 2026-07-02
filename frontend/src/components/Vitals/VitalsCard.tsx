import { Heart, Wind, Thermometer, Droplets, Activity } from 'lucide-react';

interface VitalReading {
  label: string;
  value: number | string | null;
  unit: string;
  icon: React.ReactNode;
  color: string;
  isCritical?: boolean;
}

interface VitalsCardProps {
  heartRate?: number | null;
  systolicBP?: number | null;
  diastolicBP?: number | null;
  spO2?: number | null;
  temperature?: number | null;
  respiratoryRate?: number | null;
  recordedAt?: string;
  isCritical?: boolean;
}

export const VitalsCard = ({
  heartRate,
  systolicBP,
  diastolicBP,
  spO2,
  temperature,
  respiratoryRate,
  recordedAt,
  isCritical,
}: VitalsCardProps) => {
  const vitals: VitalReading[] = [
    {
      label: 'Heart Rate',
      value: heartRate,
      unit: 'bpm',
      icon: <Heart size={20} />,
      color: 'text-red-500',
      isCritical: heartRate ? heartRate < 60 || heartRate > 100 : false,
    },
    {
      label: 'Blood Pressure',
      value: systolicBP && diastolicBP ? `${systolicBP}/${diastolicBP}` : null,
      unit: 'mmHg',
      icon: <Activity size={20} />,
      color: 'text-blue-500',
      isCritical: systolicBP ? systolicBP < 90 || systolicBP > 140 : false,
    },
    {
      label: 'SpO2',
      value: spO2,
      unit: '%',
      icon: <Droplets size={20} />,
      color: 'text-cyan-500',
      isCritical: spO2 ? spO2 < 95 : false,
    },
    {
      label: 'Temperature',
      value: temperature,
      unit: '°C',
      icon: <Thermometer size={20} />,
      color: 'text-orange-500',
      isCritical: temperature ? temperature < 36.1 || temperature > 37.2 : false,
    },
    {
      label: 'Respiratory Rate',
      value: respiratoryRate,
      unit: '/min',
      icon: <Wind size={20} />,
      color: 'text-green-500',
      isCritical: respiratoryRate ? respiratoryRate < 12 || respiratoryRate > 20 : false,
    },
  ];

  return (
    <div className={`bg-white rounded-2xl shadow-sm border p-6 ${isCritical ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-hospital-navy">Current Vitals</h3>
        <div className="flex items-center gap-2">
          {isCritical && (
            <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-medium animate-pulse">
              ⚠️ CRITICAL
            </span>
          )}
          {recordedAt && (
            <span className="text-clinic-text/40 text-sm">
              {new Date(recordedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {vitals.map((vital) => (
          <div
            key={vital.label}
            className={`text-center p-4 rounded-xl transition-all ${vital.isCritical ? 'bg-red-50 ring-1 ring-red-200' : 'bg-slate-50'}`}
          >
            <div className={`${vital.color} mb-2 flex justify-center`}>
              {vital.icon}
            </div>
            <div className={`text-2xl font-bold ${vital.isCritical ? 'text-red-600' : 'text-hospital-navy'}`}>
              {vital.value !== null ? vital.value : '--'}
            </div>
            <div className="text-xs text-clinic-text/50 mt-1">{vital.label}</div>
            <div className="text-xs text-clinic-text/30">{vital.unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
};