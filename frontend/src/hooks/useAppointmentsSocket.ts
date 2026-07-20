// frontend/src/hooks/useAppointmentsSocket.ts
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'https://hospi-link-two.vercel.app')
  .replace('/api', '');

export const useAppointmentsSocket = () => {
  const [latestUpdate, setLatestUpdate] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      console.log('Connected to appointments stream');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('Appointments socket error:', err.message);
      setIsConnected(false);
    });

    socket.on('appointment-created', (data) => {
      console.log('Appointment created:', data);
      setLatestUpdate({ type: 'created', data });
    });

    socket.on('appointment-updated', (data) => {
      console.log('Appointment updated:', data);
      setLatestUpdate({ type: 'updated', data });
    });

    socket.on('appointment-cancelled', (data) => {
      console.log('Appointment cancelled:', data);
      setLatestUpdate({ type: 'cancelled', data });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { latestUpdate, isConnected };
};