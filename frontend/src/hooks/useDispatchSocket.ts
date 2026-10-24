// frontend/src/hooks/useDispatchSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config/env';


export interface UnitUpdate {
  unitId: string;
  unitCode?: string;
  status: string;
  lat?: number;
  lng?: number;
  eta?: number;
  timestamp: Date;
}

export interface CriticalAlert {
  message: string;
  [key: string]: unknown;
}

export interface DispatchCall {
  callId: string;
  type: string;
  location: string;
  priority: string;
  timestamp: Date;
}

export const useDispatchSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [latestUnitUpdate, setLatestUnitUpdate] = useState<UnitUpdate | null>(null);
  const [latestCall, setLatestCall] = useState<DispatchCall | null>(null);
  const [criticalAlert, setCriticalAlert] = useState<CriticalAlert | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('join-dispatch');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('connect_error', () => {
      setIsConnected(false);
    });

    newSocket.on('unit-status-update', (data: UnitUpdate) => {
      setLatestUnitUpdate(data);
    });

    newSocket.on('unit-location', (data: UnitUpdate) => {
      setLatestUnitUpdate(data);
    });

    newSocket.on('new-call', (data: DispatchCall) => {
      setLatestCall(data);
    });

    newSocket.on('critical-alert', (data: CriticalAlert) => {
      setCriticalAlert(data);
    });

    newSocket.on('call-assigned', (data: UnitUpdate) => {
      setLatestUnitUpdate(data);
    });

    socketRef.current = newSocket;

    return () => {
      newSocket.emit('leave-dispatch');
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinDepartment = useCallback((department: string) => {
    socketRef.current?.emit('join-department', department);
  }, []);

  const leaveDepartment = useCallback((department: string) => {
    socketRef.current?.emit('leave-department', department);
  }, []);

  const trackUnit = useCallback((unitId: string) => {
    socketRef.current?.emit('track-unit', unitId);
  }, []);

  const untrackUnit = useCallback((unitId: string) => {
    socketRef.current?.emit('untrack-unit', unitId);
  }, []);

  return {
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