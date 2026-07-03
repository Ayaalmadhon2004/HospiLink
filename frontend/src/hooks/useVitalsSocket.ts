// frontend/src/hooks/useVitalsSocket.ts
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

export const useVitalsSocket = (patientId: string) => {
  const [latestVital, setLatestVital] = useState(null);

  useEffect(() => {
    socket.emit('join-room', patientId);
    socket.on('new-vital', (data) => {
      setLatestVital(data);
    });
    return () => { socket.off('new-vital'); };
  }, [patientId]);

  return latestVital;
};
