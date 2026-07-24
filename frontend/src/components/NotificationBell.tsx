// frontend/src/components/NotificationBell.tsx
import { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';

export const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClick = (n: any) => {
    if (!n.read) markAsRead(n.id);
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-gray-800">Notifications</h3>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded transition"
                  title="Mark all as read"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">No notifications</div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={`p-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition ${
                  !n.read ? 'bg-teal-50/30' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${!n.read ? 'text-gray-900' : 'text-gray-600'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(n.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n.id);
                    }}
                    className="p-1 text-gray-300 hover:text-red-500 rounded transition shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};