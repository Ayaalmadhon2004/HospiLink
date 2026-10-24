// frontend/src/hooks/useIncidentsSocket.ts
import { logger } from '../utils/logger';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { Incident } from '../types/incident';
import { SOCKET_URL } from '../config/env';


export const useIncidentsSocket = () => {
  const [latestUpdate, setLatestUpdate] = useState<{ type: 'created' | 'updated' | 'status'; data: Incident } | null>(null);
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
      logger.warn('Incidents socket error:', err.message);
      setIsConnected(false);
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

  return { latestUpdate, isConnected };
};