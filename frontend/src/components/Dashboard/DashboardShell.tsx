import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DashboardShellProps {
  /** Name of the current section, shown in the top bar on phones. */
  title: string;
  /** Receives a function that closes the phone menu; call it after navigating. */
  renderSidebar: (closeMenu: () => void) => ReactNode;
  mainLabel: string;
  /** Floats at the top end of the page (e.g. the notification bell); on phones it sits on the top bar. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Page frame for the dashboard. From the `md` breakpoint up the sidebar is a fixed column next to the content;
 * below it the sidebar becomes a drawer opened from a top bar, so the content keeps the full phone width.
 */
export const DashboardShell = ({ title, renderSidebar, mainLabel, actions, children }: DashboardShellProps) => {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <div className="flex flex-col md:flex-row w-full h-screen overflow-hidden bg-gray-50">
      {/* Top bar, phones only */}
      <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 text-white shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? t('sidebar.closeMenu') : t('sidebar.openMenu')}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          className="p-2 -ms-2 rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          {menuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
        </button>
        <span className="font-semibold truncate">{title}</span>
      </header>

      {menuOpen && (
        <div
          data-testid="sidebar-backdrop"
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      <div
        id={menuId}
        className={`fixed inset-y-0 start-0 z-40 shrink-0 transition-[transform,visibility] duration-200 md:static md:visible md:translate-x-0 ${
          menuOpen ? 'visible translate-x-0' : 'invisible -translate-x-full rtl:translate-x-full'
        }`}
      >
        {renderSidebar(closeMenu)}
      </div>

      {actions && <div className="fixed top-1.5 end-3 z-20 md:top-3 md:end-6 text-white md:text-gray-600">{actions}</div>}

      <main className="flex-1 overflow-y-auto p-4 md:p-8 md:pt-16" role="main" aria-label={mainLabel}>
        {children}
      </main>
    </div>
  );
};
