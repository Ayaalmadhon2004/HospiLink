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
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebarBadges } from '../../hooks/useSidebarBadges';

interface SidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
}

const Sidebar = ({ activeItem, onItemClick }: SidebarProps) => {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const badges = useSidebarBadges(user?.role);

  const menuItems: { id: string; label: string; icon: typeof Users; badge: string | null }[] = [
    { id: 'Overview', label: t('sidebar.tabs.Overview'), icon: LayoutDashboard, badge: null },
    { id: 'Patients', label: t('sidebar.tabs.Patients'), icon: Users, badge: badges.Patients },
    { id: 'Beds & Wards', label: t('sidebar.tabs.Beds & Wards'), icon: BedDouble, badge: null },
    { id: 'Staff & Shifts', label: t('sidebar.tabs.Staff & Shifts'), icon: Stethoscope, badge: null },
    { id: 'Appointments', label: t('sidebar.tabs.Appointments'), icon: Calendar, badge: badges.Appointments },
    { id: 'Vitals Monitor', label: t('sidebar.tabs.Vitals Monitor'), icon: Activity, badge: badges.Vitals },
    { id: 'Incidents', label: t('sidebar.tabs.Incidents'), icon: AlertTriangle, badge: badges.Incidents },
    { id: 'Dispatch', label: t('sidebar.tabs.Dispatch'), icon: Truck, badge: null },
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
    <aside className="w-64 h-screen bg-gradient-to-b from-hospital-navy to-teal-700 text-white flex flex-col">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">HospiLink</h1>
            <p className="text-xs text-slate-400">{t('sidebar.central')}</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-4 space-y-1">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-4">
          {t('sidebar.clinicalOperations')}
        </div>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemClick(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm group ${
              activeItem === item.id
                ? 'bg-white/20 text-white font-semibold border-s-2 border-white shadow-sm'
                : 'text-white/90 hover:bg-white/15 hover:text-white border-s-2 border-transparent'
            }`}
          >
            <item.icon className={`w-5 h-5 transition-colors ${
              activeItem === item.id ? 'text-teal-400' : 'text-slate-300 group-hover:text-white'
            }`} />
            <span className="flex-1 text-start font-medium">{item.label}</span>
            {item.badge && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                activeItem === item.id 
                  ? 'bg-white text-hospital-navy'
                  : 'bg-white/20 text-white'
              }`}>
                {item.badge}
              </span>
            )}
            {activeItem === item.id && (
              <ChevronRight className="w-4 h-4 text-teal-400 rtl:rotate-180" aria-hidden="true" />
            )}
          </button>
        ))}
      </nav>

      {/* Settings */}
      <div className="px-4 pb-2 space-y-1">
        <LanguageSwitcher className="w-full px-4 py-3 text-white/90 hover:bg-white/15 hover:text-white" />
        <button
          onClick={() => onItemClick('Settings')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm group ${
            activeItem === 'Settings'
              ? 'bg-white/20 text-white font-semibold border-s-2 border-white'
              : 'text-white/90 hover:bg-white/15 hover:text-white border-s-2 border-transparent'
          }`}
        >
          <Settings className={`w-5 h-5 ${
            activeItem === 'Settings' ? 'text-teal-400' : 'text-slate-300 group-hover:text-white'
          }`} />
          <span className="flex-1 text-start font-medium">{t('sidebar.tabs.Settings')}</span>
        </button>
      </div>

      {/* Bottom - Dynamic Profile */}
      <div className="p-4 border-t border-white/15">
        {loading ? (
          <div className="flex items-center gap-3 px-4 py-3">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            <span className="text-sm text-slate-400">{t('common.loading')}</span>
          </div>
        ) : user ? (
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white shrink-0">
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
              <p className="text-sm text-slate-400">{t('sidebar.notLoggedIn')}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;