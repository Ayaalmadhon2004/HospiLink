// frontend/src/hooks/useAppointmentsSocket.ts
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export const useAppointmentsSocket = () => {
  const [latestUpdate, setLatestUpdate] = useState<any>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
      console.log('Connected to appointments stream');
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

  return latestUpdate;
};
