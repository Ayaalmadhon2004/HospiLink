// frontend/src/components/Staff/ShiftTimeline.tsx
import { Users } from 'lucide-react';

interface ShiftTimelineProps {
  timeline: Record<string, any[]> | null;
}

const SHIFT_COLORS: Record<string, string> = {
  DAY: 'bg-blue-100 text-blue-600 border-blue-200',
  NIGHT: 'bg-indigo-100 text-indigo-600 border-indigo-200',
  EVENING: 'bg-orange-100 text-orange-600 border-orange-200',
  ON_CALL: 'bg-purple-100 text-purple-600 border-purple-200',
};

export const ShiftTimeline = ({ timeline }: ShiftTimelineProps) => {
  if (!timeline || Object.keys(timeline).length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-hospital-navy mb-2">Shift Timeline</h3>
        <p className="text-clinic-text/40 text-sm">No shifts scheduled for today</p>
      </div>
    );
  }

  const departments = Object.keys(timeline);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-hospital-navy">Shift Timeline</h3>
        <span className="text-xs text-clinic-text/40">24-hour coverage</span>
      </div>

      <div className="space-y-4">
        {departments.map((dept) => {
          const shifts = timeline[dept];
          return (
            <div key={dept} className="relative">
              <h4 className="text-sm font-medium text-clinic-text/70 mb-2">{dept}</h4>
              <div className="relative h-10 bg-slate-50 rounded-lg overflow-hidden">
                {/* Time markers */}
                <div className="absolute inset-0 flex">
                  {[0, 4, 8, 12, 16, 20].map((hour) => (
                    <div key={hour} className="flex-1 border-r border-slate-200 last:border-r-0 relative">
                      <span className="absolute top-0 left-1 text-[10px] text-clinic-text/30">
                        {hour.toString().padStart(2, '0')}:00
                      </span>
                    </div>
                  ))}
                </div>

                {/* Shift blocks */}
                {shifts.map((shift) => {
                  const start = new Date(shift.startTime).getHours();
                  const end = new Date(shift.endTime).getHours();
                  const left = (start / 24) * 100;
                  const width = ((end - start) / 24) * 100;

                  return (
                    <div
                      key={shift.id}
                      className={`absolute top-4 h-6 rounded-md border text-xs flex items-center px-2 truncate ${SHIFT_COLORS[shift.type] || 'bg-slate-100 text-slate-600'}`}
                      style={{ left: `${left}%`, width: `${Math.max(width, 8)}%` }}
                      title={`${shift.staffName} - ${shift.type}`}
                    >
                      <Users size={10} className="mr-1 shrink-0" />
                      <span className="truncate">{shift.staffName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};