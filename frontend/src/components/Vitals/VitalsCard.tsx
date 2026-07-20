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
      value: heartRate ?? null,
      unit: 'bpm',
      icon: <Heart size={20} aria-hidden="true" />,
      color: 'text-red-500',
      isCritical: heartRate ? heartRate < 60 || heartRate > 100 : false,
    },
    {
      label: 'Blood Pressure',
      value: systolicBP && diastolicBP ? `${systolicBP}/${diastolicBP}` : null,
      unit: 'mmHg',
      icon: <Activity size={20} aria-hidden="true" />,
      color: 'text-blue-500',
      isCritical: systolicBP ? systolicBP < 90 || systolicBP > 140 : false,
    },
    {
      label: 'SpO₂',
      value: spO2 ?? null,
      unit: '%',
      icon: <Droplets size={20} aria-hidden="true" />,
      color: 'text-cyan-500',
      isCritical: spO2 ? spO2 < 95 : false,
    },
    {
      label: 'Temperature',
      value: temperature ?? null,
      unit: '°C',
      icon: <Thermometer size={20} aria-hidden="true" />,
      color: 'text-orange-500',
      isCritical: temperature ? temperature < 36.1 || temperature > 37.2 : false,
    },
    {
      label: 'Respiratory Rate',
      value: respiratoryRate ?? null,
      unit: '/min',
      icon: <Wind size={20} aria-hidden="true" />,
      color: 'text-green-500',
      isCritical: respiratoryRate ? respiratoryRate < 12 || respiratoryRate > 20 : false,
    },
  ];

  return (
    <section
      className={`bg-white rounded-2xl shadow-sm border p-6 ${isCritical ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'}`}
      aria-label="Current vital signs"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-hospital-navy">Current Vitals</h3>
        <div className="flex items-center gap-2">
          {isCritical && (
            <span
              className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-medium animate-pulse"
              role="alert"
              aria-live="assertive"
            >
              ⚠️ CRITICAL
            </span>
          )}
          {recordedAt && (
            <time
              className="text-clinic-text/40 text-sm"
              dateTime={recordedAt}
            >
              {new Date(recordedAt).toLocaleTimeString()}
            </time>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4" role="list" aria-label="Vital readings">
        {vitals.map((vital) => (
          <div
            key={vital.label}
            className={`text-center p-4 rounded-xl transition-all ${vital.isCritical ? 'bg-red-50 ring-1 ring-red-200' : 'bg-slate-50'}`}
            role="listitem"
            aria-label={`${vital.label}: ${vital.value !== null ? vital.value : 'no data'} ${vital.unit}${vital.isCritical ? ', critical value' : ''}`}
          >
            <div className={`${vital.color} mb-2 flex justify-center`} aria-hidden="true">
              {vital.icon}
            </div>
            <div className={`text-2xl font-bold ${vital.isCritical ? 'text-red-600' : 'text-hospital-navy'}`}>
              {vital.value !== null ? vital.value : '—'}
            </div>
            <div className="text-xs text-clinic-text/50 mt-1">{vital.label}</div>
            <div className="text-xs text-clinic-text/30">{vital.unit}</div>
          </div>
        ))}
      </div>
    </section>
  );
};