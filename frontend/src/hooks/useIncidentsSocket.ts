// frontend/src/hooks/useIncidentsSocket.ts
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export const useIncidentsSocket = () => {
  const [latestUpdate, setLatestUpdate] = useState<any>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
      console.log('Connected to incidents stream');
    });

    socket.on('incident-created', (data) => {
      setLatestUpdate({ type: 'created', data });
    });

    socket.on('incident-updated', (data) => {
      setLatestUpdate({ type: 'updated', data });
    });

    socket.on('incident-status-updated', (data) => {
      setLatestUpdate({ type: 'status', data });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return latestUpdate;
};