import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
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
 * Page frame for the dashboard. From the `lg` breakpoint up the sidebar is a fixed column next to the content;
 * below it the sidebar becomes a drawer opened from a top bar, so the content keeps the full phone width.
 */
export const DashboardShell = ({ title, renderSidebar, mainLabel, actions, children }: DashboardShellProps) => {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // Focus: move into the drawer when it opens, give it back to the hamburger button when it closes.
  useEffect(() => {
    if (menuOpen) {
      drawerRef.current?.querySelector<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')?.focus();
    } else if (wasOpen.current) {
      toggleRef.current?.focus();
    }
    wasOpen.current = menuOpen;
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <div className="flex flex-col lg:flex-row w-full h-screen overflow-hidden bg-gray-50">
      {/* Top bar, phones only */}
      <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-hospital-navy to-teal-700 text-white shrink-0">
        <button
          ref={toggleRef}
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
          className="lg:hidden fixed inset-0 z-30 bg-hospital-navy/50"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      <div
        id={menuId}
        ref={drawerRef}
        className={`fixed inset-y-0 start-0 z-40 shrink-0 transition-[transform,visibility] duration-200 lg:static lg:visible lg:translate-x-0 ${
          menuOpen ? 'visible translate-x-0' : 'invisible -translate-x-full rtl:translate-x-full'
        }`}
      >
        {renderSidebar(closeMenu)}
      </div>

      {actions && <div className="fixed top-1.5 end-3 z-20 lg:top-3 lg:end-6 text-white lg:text-gray-600">{actions}</div>}

      <main className="flex-1 overflow-y-auto p-4 lg:p-8 lg:pt-16" role="main" aria-label={mainLabel}>
        {children}
      </main>
    </div>
  );
};
