import { memo, useRef, useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, type ChartOptions } from 'chart.js';

// ✅ Register once globally - NOT inside component
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

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

const PatientFlowChart = memo(({ data, title = 'Patient Flow' }: PatientFlowChartProps) => {
  const chartRef = useRef<ChartJS<'line'>>(null);
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

  // ─── Cleanup chart on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, []);

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { size: 12 },
        },
      },
      title: {
        display: !!title,
        text: title,
        font: { size: 16, weight: 'bold' },
        padding: { bottom: 20 },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: { font: { size: 11 } },
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
    animation: {
      duration: 800,
      easing: 'easeOutQuart',
    },
  };

  return (
    <figure
      ref={containerRef}
      className="bg-white rounded-xl shadow-sm border p-4"
      aria-label={`${title} chart showing patient flow data over time`}
    >
      {isVisible ? (
        <Line ref={chartRef} options={options} data={data} />
      ) : (
        <div
          className="flex items-center justify-center py-12 text-gray-400"
          role="status"
          aria-live="polite"
          aria-label="Loading chart"
        >
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="w-48 h-32 bg-gray-200 rounded-lg" aria-hidden="true" />
            <span className="text-sm">Loading chart...</span>
          </div>
        </div>
      )}
    </figure>
  );
});

PatientFlowChart.displayName = 'PatientFlowChart';

export { PatientFlowChart };