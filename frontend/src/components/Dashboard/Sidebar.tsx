// frontend/src/components/Dashboard/Sidebar.tsx
import { NavLink } from 'react-router-dom';
import { Heart, ChevronRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/authContext';
import { canAccessRoute } from '../../configs/permissions';
import { useSidebarBadges } from '../../hooks/useSidebarBadges';
import { enumLabel } from '../../utils/enumLabel';
import { NAV_ITEMS, SETTINGS_NAV_ITEM, type NavItem } from '../../configs/navigation';

interface SidebarProps {
  /** Called after a link is followed (the phone drawer closes itself with it). */
  onNavigate?: () => void;
}

const linkClass = (isActive: boolean): string =>
  `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm group ${
    isActive
      ? 'bg-emerald-400/15 text-emerald-300 font-semibold border-s-2 border-emerald-400'
      : 'text-white/90 hover:bg-white/15 hover:text-white border-s-2 border-transparent'
  }`;

const Sidebar = ({ onNavigate }: SidebarProps) => {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const badges = useSidebarBadges(user?.role);

  const renderItem = (item: NavItem) => {
    const badge = item.badge ? badges[item.badge] : null;
    return (
      <NavLink
        key={item.id}
        to={item.path}
        end={item.id === 'Overview'}
        onClick={onNavigate}
        className={({ isActive }) => linkClass(isActive)}
      >
        {({ isActive }) => (
          <>
            <item.icon
              aria-hidden="true"
              className={`w-5 h-5 transition-colors ${isActive ? 'text-teal-400' : 'text-slate-300 group-hover:text-white'}`}
            />
            <span className="flex-1 text-start font-medium">{t(`sidebar.tabs.${item.id}`)}</span>
            {badge && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  isActive ? 'bg-emerald-500 text-emerald-950' : 'bg-white/20 text-white'
                }`}
              >
                {badge}
              </span>
            )}
            {isActive && <ChevronRight className="w-4 h-4 text-emerald-300 rtl:rotate-180" aria-hidden="true" />}
          </>
        )}
      </NavLink>
    );
  };

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
    <aside className="w-64 shrink-0 h-full lg:h-screen bg-sidebar text-white flex flex-col">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
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
        {NAV_ITEMS.filter((item) => canAccessRoute(user?.role, item.path)).map(renderItem)}
      </nav>

      {/* Settings */}
      <div className="px-4 pb-2 space-y-1">
        {renderItem(SETTINGS_NAV_ITEM)}
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
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {getInitials(user.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{enumLabel(t, 'role', user.role)}</p>
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