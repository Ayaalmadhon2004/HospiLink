// frontend/src/components/NotificationBell.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Check, Trash2, X, HeartPulse, AlertTriangle, Ambulance, CalendarClock, Clock, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Notification } from '../types/notification';

const TYPE_ICONS: Record<string, typeof Info> = {
  VITALS: HeartPulse,
  INCIDENT: AlertTriangle,
  DISPATCH: Ambulance,
  APPOINTMENT: CalendarClock,
  SHIFT: Clock,
};
const TYPE_COLORS: Record<string, string> = {
  VITALS: 'text-red-600 bg-red-50',
  INCIDENT: 'text-amber-600 bg-amber-50',
  DISPATCH: 'text-orange-600 bg-orange-50',
  APPOINTMENT: 'text-teal-600 bg-teal-50',
  SHIFT: 'text-indigo-600 bg-indigo-50',
};

type Filter = 'all' | 'unread';

export const NotificationBell = () => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const navigate = useNavigate();

  // Live toast for every notification pushed over the socket.
  const handleIncoming = useCallback(
    (n: Notification) => {
      const show = n.type === 'VITALS' ? toast.error : n.type === 'INCIDENT' || n.type === 'DISPATCH' ? toast.warning : toast.info;
      show(n.title, {
        description: n.message,
        action: n.link ? { label: t('notifications.view'), onClick: () => navigate(n.link as string) } : undefined,
      });
    },
    [navigate, t],
  );
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications(handleIncoming);
  const visible = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClick = (n: Notification) => {
    if (!n.read) markAsRead(n.id);
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, n: Notification) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(n);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-current hover:bg-white/10 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-teal-400"
        aria-label={t('common.notifications')}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 end-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] text-gray-800 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-gray-800">{t('common.notifications')}</h3>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded transition"
                  title={t('notifications.markAllRead')}
                  aria-label={t('notifications.markAllRead')}
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition"
                aria-label={t('notifications.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-1 px-3 py-2 border-b border-gray-100" role="group" aria-label={t('notifications.filter')}>
            {(['all', 'unread'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`px-2 py-0.5 rounded-full text-xs transition ${
                  filter === f ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t(f === 'all' ? 'notifications.filterAll' : 'notifications.filterUnread')}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">{t('notifications.empty')}</div>
          ) : (
            visible.map((n) => {
              const Icon = TYPE_ICONS[n.type] ?? Info;
              return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => handleClick(n)}
                onKeyDown={(e) => handleKeyDown(e, n)}
                className={`w-full text-start p-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition ${
                  !n.read ? 'bg-teal-50/30' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`mt-0.5 p-1.5 rounded-full shrink-0 ${TYPE_COLORS[n.type] ?? 'text-gray-600 bg-gray-100'}`}
                    aria-hidden="true"
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${!n.read ? 'text-gray-900' : 'text-gray-600'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{n.message}</p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {new Date(n.createdAt).toLocaleTimeString(i18n.language)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n.id);
                    }}
                    className="p-1 text-gray-500 hover:text-red-500 rounded transition shrink-0"
                    aria-label={t('notifications.delete', { title: n.title })}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};