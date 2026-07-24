// frontend/src/hooks/useIncidentsSocket.ts
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'https://hospi-link-two.vercel.app')
  .replace('/api', '');

export const useIncidentsSocket = () => {
  const [latestUpdate, setLatestUpdate] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'], // شو هنا يعني الترانسبورتس وايش معنا حاطين بولنج وويب سوكيت 
      withCredentials: true,
      /*
      انا شفت بالصفحة بس هاد السكشن وتل ما قلت ما في سويتش او اشي بخليك تختار ؟  useEffect(() => {
    if (!latestUpdate) return;
    const updateId = (latestUpdate as any)?.id || JSON.stringify(latestUpdate);
    if (updateId === lastSocketId.current) return;
    lastSocketId.current = updateId;
    fetchIncidents();
  }, [latestUpdate, fetchIncidents]);
      */
    });

    socket.on('connect', () => {
      console.log('Connected to incidents stream');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('Incidents socket error:', err.message);
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
  // احنا هنا بنرجع اللاتست ابديت في السوكيت انه اذا هيك اعمل هيك وطيب ولما نرجع اللاتست ابديت كيف بفهم اي نوع من السوكيت وهو ما في سويتش مثلا ؟
};