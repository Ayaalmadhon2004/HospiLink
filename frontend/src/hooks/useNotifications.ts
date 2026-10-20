// frontend/src/hooks/useNotifications.ts
import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { apiGet, apiPut, apiDelete } from '../services/api';
import type { ApiResponse } from '../types/api';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'https://hospi-link-two.vercel.app')
  .replace('/api', '');

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet<ApiResponse<{ data?: Notification[]; unreadCount?: number }>>('/notifications');
      setNotifications(res.data?.data || []);
      setUnreadCount(res.data?.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await apiPut(`/notifications/${id}/read`, {});
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiPut('/notifications/read-all', {});
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await apiDelete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- effect intentionally syncs/fetches into state (data load or reset on prop change); restructuring would change behaviour
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Real-time: backend emits 'new-notification' to room user-<id> (joined on connect)
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      withCredentials: true,
    });

    socket.on('new-notification', (n: Notification) => {
      setNotifications(prev => (prev.some(x => x.id === n.id) ? prev : [n, ...prev]));
      if (!n.read) setUnreadCount(prev => prev + 1);
    });

    return () => {
      socket.off('new-notification');
      socket.disconnect();
    };
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: fetchNotifications,
  };
};