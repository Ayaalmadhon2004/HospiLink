import { memo, useRef, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface FlowData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
  }>;
}

interface PatientFlowChartProps {
  data: FlowData;
  title?: string;
}

const PatientFlowChart = memo(({ data, title }: PatientFlowChartProps) => {
  const { t } = useTranslation();
  const chartTitle = title ?? t('patients.flow.title');
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // ─── Intersection Observer for lazy rendering ────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // ─── Transform chart.js data format to recharts format ───────────
  const chartData = useMemo(() => {
    if (!data.labels || !data.datasets) return [];
    return data.labels.map((label, index) => {
      const point: Record<string, string | number> = { label };
      data.datasets.forEach((dataset) => {
        point[dataset.label] = dataset.data[index] ?? 0;
      });
      return point;
    });
  }, [data]);

  const colors = ['#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

  return (
    <figure
      ref={containerRef}
      className="bg-white rounded-xl shadow-sm border p-4"
      aria-label={t('patients.flow.chartLabel', { title: chartTitle })}
    >
      {isVisible ? (
        <>
          {chartTitle && (
            <figcaption className="text-base font-bold text-gray-700 mb-4 text-center">
              {chartTitle}
            </figcaption>
          )}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                {data.datasets.map((dataset, idx) => (
                  <Line
                    key={dataset.label}
                    type="monotone"
                    dataKey={dataset.label}
                    stroke={dataset.borderColor || colors[idx % colors.length]}
                    strokeWidth={2}
                    dot={{ r: 3, fill: dataset.borderColor || colors[idx % colors.length], strokeWidth: 0 }}
                    activeDot={{ r: 5, stroke: dataset.borderColor || colors[idx % colors.length], strokeWidth: 2, fill: '#fff' }}
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div
          className="flex items-center justify-center py-12 text-gray-500"
          role="status"
          aria-live="polite"
          aria-label={t('patients.flow.loadingChart')}
        >
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="w-48 h-32 bg-gray-200 rounded-lg" aria-hidden="true" />
            <span className="text-sm">{t('patients.flow.loadingChart')}</span>
          </div>
        </div>
      )}
    </figure>
  );
});

PatientFlowChart.displayName = 'PatientFlowChart';

export { PatientFlowChart };