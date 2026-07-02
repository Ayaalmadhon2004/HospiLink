interface VitalsHistory {
  recordedAt: string;
  value: number | null;
}

interface VitalsChartProps {
  data: VitalsHistory[];
  color?: string;
  label: string;
}

export const VitalsChart = ({ data, color = '#2dd4bf', label }: VitalsChartProps) => {
  const validData = data.filter((d) => d.value !== null).slice(-12);

  if (validData.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h4 className="text-sm font-medium text-clinic-text/60 mb-2">{label}</h4>
        <div className="text-center text-clinic-text/30 py-8">No data</div>
      </div>
    );
  }

  const values = validData.map((d) => d.value as number);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h4 className="text-sm font-medium text-clinic-text/60 mb-4">{label}</h4>
      <div className="h-40 flex items-end gap-1">
        {validData.map((point, i) => {
          const height = ((point.value! - min) / range) * 80 + 10;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-sm transition-all"
                style={{ height: `${height}%`, backgroundColor: color, opacity: 0.6 + (i / validData.length) * 0.4 }}
              />
              <span className="text-[10px] text-clinic-text/30 -rotate-45 origin-left translate-y-2">
                {new Date(point.recordedAt).getHours()}:00
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};