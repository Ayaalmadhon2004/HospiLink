// frontend/src/hooks/useStaffSocket.ts
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'https://hospi-link-two.vercel.app')
  .replace('/api', '');

export const useStaffSocket = (department?: string) => {
  const [latestShift, setLatestShift] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!department) return;

    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      console.log('Connected to staff stream');
      setIsConnected(true);
      socket.emit('join-department', department);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('Staff socket error:', err.message);
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