// frontend/src/hooks/useStaffSocket.ts
import { logger } from '../utils/logger';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { Shift } from '../types/staff';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'https://hospi-link-two.vercel.app')
  .replace('/api', '');

export const useStaffSocket = (department?: string) => {
  const [latestShift, setLatestShift] = useState<(Shift & { deleted?: boolean }) | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!department) return;

    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-department', department);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      logger.warn('Staff socket error:', err.message);
      setIsConnected(false);
    });

    socket.on('shift-update', (data) => {
      setLatestShift(data);
    });

    socket.on('shift-delete', (data) => {
      setLatestShift({ ...data, deleted: true });
    });

    return () => {
      socket.emit('leave-department', department);
      socket.disconnect();
    };
  }, [department]);

  return { latestShift, isConnected };
};