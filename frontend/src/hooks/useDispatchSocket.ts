// frontend/src/hooks/useDispatchSocket.ts
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'https://hospi-link-two.vercel.app')
  .replace('/api', '');

export interface UnitUpdate {
  unitId: string;
  unitCode?: string;
  status: string;
  location?: { lat: number; lng: number };
  eta?: number;
  timestamp: Date;
}

export interface DispatchCall {
  callId: string;
  type: string;
  location: string;
  priority: string;
  timestamp: Date;
}

export const useDispatchSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [latestUnitUpdate, setLatestUnitUpdate] = useState<UnitUpdate | null>(null);
  const [latestCall, setLatestCall] = useState<DispatchCall | null>(null);
  const [criticalAlert, setCriticalAlert] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      console.log('🚑 Connected to dispatch stream');
      setIsConnected(true);
      newSocket.emit('join-dispatch');
    });

    newSocket.on('disconnect', () => {
      console.log('🚑 Disconnected from dispatch stream');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.warn('Dispatch socket error:', err.message);
      setIsConnected(false);
    });

    newSocket.on('unit-status-update', (data: UnitUpdate) => {
      console.log('Unit status update:', data);
      setLatestUnitUpdate(data);
    });

    newSocket.on('unit-location', (data: UnitUpdate) => {
      console.log('Unit location:', data);
      setLatestUnitUpdate(data);
    });

    newSocket.on('new-call', (data: DispatchCall) => {
      console.log('New dispatch call:', data);
      setLatestCall(data);
    });

    newSocket.on('critical-alert', (data: any) => {
      console.log('CRITICAL ALERT:', data);
      setCriticalAlert(data);
    });

    newSocket.on('call-assigned', (data: any) => {
      console.log('Call assigned:', data);
      setLatestUnitUpdate(data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('leave-dispatch');
      newSocket.disconnect();
    };
  }, []);

  const joinDepartment = useCallback((department: string) => {
    socket?.emit('join-department', department);
  }, [socket]);

  const leaveDepartment = useCallback((department: string) => {
    socket?.emit('leave-department', department);
  }, [socket]);

  const trackUnit = useCallback((unitId: string) => {
    socket?.emit('track-unit', unitId);
  }, [socket]);

  const untrackUnit = useCallback((unitId: string) => {
    socket?.emit('untrack-unit', unitId);
  }, [socket]);

  return {
    socket,
    isConnected,
    latestUnitUpdate,
    latestCall,
    criticalAlert,
    joinDepartment,
    leaveDepartment,
    trackUnit,
    untrackUnit
  };
};