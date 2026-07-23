// frontend/src/components/Dashboard/Sidebar.tsx
import { 
  LayoutDashboard, 
  Users, 
  BedDouble, 
  Stethoscope, 
  Calendar, 
  Activity, 
  AlertTriangle, 
  Truck,
  Heart,
  Settings,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
}

const Sidebar = ({ activeItem, onItemClick }: SidebarProps) => {
  const { user, loading } = useAuth();

  const menuItems = [
    { id: 'Overview', label: 'Overview', icon: LayoutDashboard, badge: null },
    { id: 'Patients', label: 'Patients', icon: Users, badge: '1.2k' },
    { id: 'Beds & Wards', label: 'Beds & Wards', icon: BedDouble, badge: null },
    { id: 'Staff & Shifts', label: 'Staff & Shifts', icon: Stethoscope, badge: null },
    { id: 'Appointments', label: 'Appointments', icon: Calendar, badge: null },
    { id: 'Vitals Monitor', label: 'Vitals Monitor', icon: Activity, badge: '3' },
    { id: 'Incidents', label: 'Incidents', icon: AlertTriangle, badge: '7' },
    { id: 'Dispatch', label: 'Dispatch', icon: Truck, badge: null },
  ];

  // Get initials from user name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <aside className="w-64 h-screen bg-slate-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">HospiLink</h1>
            <p className="text-xs text-slate-400">Central</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-4 space-y-1">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-4">
          Clinical Operations
        </div>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemClick(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm group ${
              activeItem === item.id
                ? 'bg-teal-500/15 text-teal-400 border-l-2 border-teal-500 shadow-sm shadow-teal-500/10'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white border-l-2 border-transparent'
            }`}
          >
            <item.icon className={`w-5 h-5 transition-colors ${
              activeItem === item.id ? 'text-teal-400' : 'text-slate-400 group-hover:text-white'
            }`} />
            <span className="flex-1 text-left font-medium">{item.label}</span>
            {item.badge && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                activeItem === item.id 
                  ? 'bg-teal-500 text-white' 
                  : 'bg-slate-700 text-slate-300'
              }`}>
                {item.badge}
              </span>
            )}
            {activeItem === item.id && (
              <ChevronRight className="w-4 h-4 text-teal-400" />
            )}
          </button>
        ))}
      </nav>

      {/* Settings */}
      <div className="px-4 pb-2">
        <button
          onClick={() => onItemClick('Settings')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm group ${
            activeItem === 'Settings'
              ? 'bg-teal-500/15 text-teal-400 border-l-2 border-teal-500'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white border-l-2 border-transparent'
          }`}
        >
          <Settings className={`w-5 h-5 ${
            activeItem === 'Settings' ? 'text-teal-400' : 'text-slate-400 group-hover:text-white'
          }`} />
          <span className="flex-1 text-left font-medium">Settings</span>
        </button>
      </div>

      {/* Bottom - Dynamic Profile */}
      <div className="p-4 border-t border-slate-800">
        {loading ? (
          <div className="flex items-center gap-3 px-4 py-3">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            <span className="text-sm text-slate-400">Loading...</span>
          </div>
        ) : user ? (
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {getInitials(user.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.role}</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-400 shrink-0">
              ?
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-400">Not logged in</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;