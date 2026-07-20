// frontend/src/hooks/useVitalsSocket.ts
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'https://hospi-link-two.vercel.app')
  .replace('/api', '');

const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['polling', 'websocket'],
  withCredentials: true,
});

export const useVitalsSocket = (patientId: string) => {
  const [latestVital, setLatestVital] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!patientId) return;

    socket.connect();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onConnectError = (err: any) => {
      console.warn('Vitals socket error:', err.message);
      setIsConnected(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    socket.emit('join-room', patientId);

    const handleNewVital = (data: any) => {
      setLatestVital(data);
    };

    socket.on('new-vital', handleNewVital);

    return () => {
      socket.emit('leave-room', patientId);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('new-vital', handleNewVital);
      socket.disconnect();
    };
  }, [patientId]);

  return { latestVital, isConnected };
};