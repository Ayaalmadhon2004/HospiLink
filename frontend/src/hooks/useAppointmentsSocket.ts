// frontend/src/hooks/useAppointmentsSocket.ts
import { logger } from '../utils/logger';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { Appointment } from '../services/appointmentsService';

interface AppointmentUpdate {
  type: 'created' | 'updated' | 'cancelled';
  data: Appointment;
}

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'https://hospi-link-two.vercel.app')
  .replace('/api', '');

export const useAppointmentsSocket = () => {
  const [latestUpdate, setLatestUpdate] = useState<AppointmentUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      logger.warn('Appointments socket error:', err.message);
      setIsConnected(false);
    });

    socket.on('appointment-created', (data) => {
      setLatestUpdate({ type: 'created', data });
    });

    socket.on('appointment-updated', (data) => {
      setLatestUpdate({ type: 'updated', data });
    });

    socket.on('appointment-cancelled', (data) => {
      setLatestUpdate({ type: 'cancelled', data });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { latestUpdate, isConnected };
};