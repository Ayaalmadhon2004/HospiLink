// frontend/src/hooks/useNotifications.ts
import { logger } from '../utils/logger';
import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { apiGet, apiPut, apiDelete } from '../services/api';
import type { Notification } from '../types/notification';

export type { Notification };

/** GET /notifications answers `{ success, data: Notification[], unreadCount }`. */
interface NotificationsResponse {
  success: boolean;
  data: Notification[];
  unreadCount: number;
}

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'https://hospi-link-two.vercel.app')
  .replace('/api', '');

const NOTIFICATIONS_KEY = ['notifications'] as const;
const POLLING_INTERVAL = 30_000;

export const useNotifications = (onIncoming?: (n: Notification) => void) => {
  const queryClient = useQueryClient();
  // Ref so a new callback identity never reconnects the socket.
  const onIncomingRef = useRef(onIncoming);
  useEffect(() => {
    onIncomingRef.current = onIncoming;
  }, [onIncoming]);

  const query = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => apiGet<NotificationsResponse>('/notifications'),
    refetchInterval: POLLING_INTERVAL,
    retry: false,
  });
  const notifications = query.data?.data ?? [];
  const unreadCount = query.data?.unreadCount ?? 0;

  const patchCache = useCallback(
    (patch: (current: NotificationsResponse) => NotificationsResponse): void => {
      queryClient.setQueryData<NotificationsResponse>(NOTIFICATIONS_KEY, (current) => patch(current ?? { success: true, data: [], unreadCount: 0 }));
    },
    [queryClient],
  );

  const markAsRead = async (id: string) => {
    try {
      await apiPut(`/notifications/${id}/read`, {});
      patchCache((cur) => ({
        ...cur,
        data: cur.data.map((n) => (n.id === id ? { ...n, read: true } : n)),
        unreadCount: Math.max(0, cur.unreadCount - 1),
      }));
    } catch (err) {
      logger.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiPut('/notifications/read-all', {});
      patchCache((cur) => ({ ...cur, data: cur.data.map((n) => ({ ...n, read: true })), unreadCount: 0 }));
    } catch (err) {
      logger.error('Failed to mark all as read:', err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await apiDelete(`/notifications/${id}`);
      patchCache((cur) => ({
        ...cur,
        data: cur.data.filter((n) => n.id !== id),
        unreadCount: cur.data.some((n) => n.id === id && !n.read) ? Math.max(0, cur.unreadCount - 1) : cur.unreadCount,
      }));
    } catch (err) {
      logger.error('Failed to delete notification:', err);
    }
  };

  // Real-time: backend emits 'new-notification' to room user-<id> (joined on connect)
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      withCredentials: true,
    });

    socket.on('new-notification', (n: Notification) => {
      patchCache((cur) =>
        cur.data.some((x) => x.id === n.id)
          ? cur
          : { ...cur, data: [n, ...cur.data], unreadCount: n.read ? cur.unreadCount : cur.unreadCount + 1 },
      );
      onIncomingRef.current?.(n);
    });

    return () => {
      socket.off('new-notification');
      socket.disconnect();
    };
  }, [patchCache]);

  return {
    notifications,
    unreadCount,
    loading: query.isPending,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: query.refetch,
  };
};