import { 
  LayoutDashboard, 
  Users, 
  BedDouble, 
  Stethoscope, 
  Calendar, 
  Activity, 
  AlertTriangle, 
  Truck,
  Heart
} from 'lucide-react';

interface SidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
}

const Sidebar = ({ activeItem, onItemClick }: SidebarProps) => {
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

  return (
    <aside className="w-64 h-screen bg-slate-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">CareSync</h1>
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
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition text-sm ${
              activeItem === item.id
                ? 'bg-teal-500/10 text-teal-400 border-l-2 border-teal-500'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeItem === item.id 
                  ? 'bg-teal-500 text-white' 
                  : 'bg-slate-700 text-slate-300'
              }`}>
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold">
            DR
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Dr. Rivera</p>
            <p className="text-xs text-slate-400">Chief of Medicine</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;