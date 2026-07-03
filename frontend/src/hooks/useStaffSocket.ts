// frontend/src/hooks/useStaffSocket.ts
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

export const useStaffSocket = (department?: string) => {
  const [latestShift, setLatestShift] = useState<any>(null);

  useEffect(() => {
    if (!department) return;

    const socket = io(SOCKET_URL, { withCredentials: true });

    socket.on('connect', () => {
      console.log('Connected to staff stream');
      socket.emit('join-department', department);
    });

    socket.on('shift-update', (data) => {
      setLatestShift(data);
    });

    socket.on('shift-delete', (data) => {
      setLatestShift({ ...data, deleted: true });
    });

    return () => {
      socket.emit('leave-department', department);
      socket.disconnect();
    };
  }, [department]);

  return latestShift;
};