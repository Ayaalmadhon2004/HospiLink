// frontend/src/hooks/useVitalsSocket.ts
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Vitals } from '../types/vitals';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'https://hospi-link-two.vercel.app')
  .replace('/api', '');

export const useVitalsSocket = (patientId: string) => {
  const [latestVital, setLatestVital] = useState<Vitals | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!patientId) return;

    const socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', () => {
      setIsConnected(false);
    });

    socket.connect();
    socket.emit('join-room', patientId);

    const handleNewVital = (data: Vitals) => {
      setLatestVital(data);
    };
    socket.on('new-vital', handleNewVital);

    return () => {
      socket.emit('leave-room', patientId);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('new-vital', handleNewVital);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [patientId]);

  return { latestVital, isConnected };
};