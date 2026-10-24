import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from '../Dashboard/Sidebar';
import { DashboardShell } from '../Dashboard/DashboardShell';
import { NotificationBell } from '../NotificationBell';
import { findNavItem } from '../../configs/navigation';

const SectionFallback = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-label={t('common.loading')}>
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
      <span className="sr-only">{t('dashboard.loadingPage')}</span>
    </div>
  );
};

/**
 * Frame of every signed-in section (sidebar + top bar + content). The section is chosen by the URL alone:
 * each route in App.tsx renders into the <Outlet />, and the sidebar highlights the link that matches it.
 */
export const AppLayout = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const item = findNavItem(pathname);
  const title = item ? t(`sidebar.tabs.${item.id}`) : 'HospiLink';

  useEffect(() => {
    document.title = `${title} | HospiLink`;
  }, [title]);

  return (
    <DashboardShell
      title={title}
      actions={<NotificationBell />}
      mainLabel={t('dashboard.mainLabel', { tab: title })}
      renderSidebar={(closeMenu) => <Sidebar onNavigate={closeMenu} />}
    >
      <Suspense fallback={<SectionFallback />}>
        <Outlet />
      </Suspense>
    </DashboardShell>
  );
};
