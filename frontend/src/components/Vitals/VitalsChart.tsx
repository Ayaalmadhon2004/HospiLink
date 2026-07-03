// frontend/src/components/Vitals/VitalsChart.tsx
import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface VitalRecord {
  id: string;
  recordedAt: string;
  heartRate: number | null;
  systolicBP: number | null;
  diastolicBP: number | null;
  spO2: number | null;
  temperature: number | null;
  respiratoryRate: number | null;
  isCritical: boolean;
}

interface VitalsChartProps {
  history: VitalRecord[];
  vitalType: keyof Omit<VitalRecord, 'id' | 'recordedAt' | 'isCritical'>;
  color: string;
  label: string;
}

// ─── Helper: Safe array check ──────────────────────────────────────────
const ensureArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  return [];
};

// ─── Helper: Safe value extraction ─────────────────────────────────────
const getValue = (record: VitalRecord, key: string): number | null => {
  if (!record || typeof record !== 'object') return null;
  const val = (record as any)[key];
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
};

// ─── Helper: Format time ────────────────────────────────────────────────
const formatTime = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

export const VitalsChart = ({ history, vitalType, color, label }: VitalsChartProps) => {
  // ✅ Defensive: ensure history is a valid array
  const safeHistory = ensureArray<VitalRecord>(history);

  // ✅ Build chart data safely
  const data = useMemo(() => {
    if (safeHistory.length === 0) return [];

    return safeHistory
      .filter((v): v is VitalRecord & { recordedAt: string } => {
        if (!v || typeof v !== 'object') return false;
        const val = getValue(v, vitalType as string);
        return val !== null && v.recordedAt != null;
      })
      .map((v) => ({
        time: formatTime(v.recordedAt),
        value: getValue(v, vitalType as string) ?? 0,
      }))
      .reverse(); // oldest first for the chart
  }, [safeHistory, vitalType]);

  // ✅ Empty state
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-clinic-text/70 mb-4">{label}</h3>
        <div className="h-48 flex items-center justify-center text-clinic-text/30 text-sm">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-clinic-text/70 mb-4">{label}</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '12px',
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5, stroke: color, strokeWidth: 2, fill: '#fff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};