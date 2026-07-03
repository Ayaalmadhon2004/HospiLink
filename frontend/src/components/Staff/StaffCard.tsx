// frontend/src/components/Staff/StaffCard.tsx
import { Mail, Phone, Stethoscope, Clock } from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar?: string;
  phone?: string;
  isActive: boolean;
  shifts?: any[];
}

interface StaffCardProps {
  member: StaffMember;
}

export const StaffCard = ({ member }: StaffCardProps) => {
  const currentShift = member.shifts?.[0];

  return (
    <div className={`bg-white rounded-2xl shadow-sm border p-5 transition-all hover:shadow-md ${member.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-medical-teal/10 flex items-center justify-center text-medical-teal font-bold text-lg">
          {member.avatar ? (
            <img src={member.avatar} alt={member.name} className="w-full h-full rounded-full object-cover" />
          ) : (
            member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-hospital-navy truncate">{member.name}</h3>
          <p className="text-sm text-clinic-text/60 flex items-center gap-1">
            <Stethoscope size={12} />
            {member.role}
          </p>
          <p className="text-xs text-clinic-text/40 mt-0.5">{member.department}</p>
        </div>

        {/* Status */}
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${member.isActive ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
          {member.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Contact Info */}
      <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
        <div className="flex items-center gap-2 text-sm text-clinic-text/60">
          <Mail size={14} />
          <span className="truncate">{member.email}</span>
        </div>
        {member.phone && (
          <div className="flex items-center gap-2 text-sm text-clinic-text/60">
            <Phone size={14} />
            <span>{member.phone}</span>
          </div>
        )}
      </div>

      {/* Current Shift */}
      {currentShift && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-sm">
            <Clock size={14} className="text-medical-teal" />
            <span className="text-medical-teal font-medium">
              {currentShift.type}
            </span>
            <span className="text-clinic-text/40 text-xs">
              {new Date(currentShift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
              {new Date(currentShift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};