import { useTranslation } from 'react-i18next';
import { VitalsChart } from './VitalsChart';
import type { VitalRecord } from '../../types/vitals';

const CHARTS = [
  { vitalType: 'heartRate', color: '#ef4444', labelKey: 'vitals.page.chartHeartRate' },
  { vitalType: 'systolicBP', color: '#3b82f6', labelKey: 'vitals.page.chartBP' },
  { vitalType: 'spO2', color: '#06b6d4', labelKey: 'vitals.page.chartSpO2' },
  { vitalType: 'temperature', color: '#f97316', labelKey: 'vitals.page.chartTemperature' },
] as const;

/** Trend charts of the selected patient (needs at least two readings to draw a line). */
export const VitalsCharts = ({ history }: { history: readonly VitalRecord[] }) => {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {CHARTS.map((chart) => (
        <VitalsChart key={chart.vitalType} history={[...history]} vitalType={chart.vitalType} color={chart.color} label={t(chart.labelKey)} />
      ))}
    </div>
  );
};
