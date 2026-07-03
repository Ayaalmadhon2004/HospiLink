// frontend/src/hooks/useVitalsSocket.ts
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// تعريف الـ URL في مكان واحد (يفضل من الـ env)
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// إنشاء الـ instance مرة واحدة خارج الـ hook (Singleton pattern)
const socket: Socket = io(SOCKET_URL, {
  autoConnect: true,
});

export const useVitalsSocket = (patientId: string) => {
  const [latestVital, setLatestVital] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    // تحديث حالة الاتصال
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // الانضمام للغرفة الجديدة
    if (patientId) {
      socket.emit('join-room', patientId);
    }

    // الاستماع للبيانات
    const handleNewVital = (data: any) => {
      setLatestVital(data);
    };

    socket.on('new-vital', handleNewVital);

    // تنظيف (Cleanup): عند تغيير الـ patientId أو إلغاء المكون
    return () => {
      if (patientId) {
        socket.emit('leave-room', patientId); // تأكد من إضافة هذا الـ event في السيرفر لاحقاً
      }
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('new-vital', handleNewVital);
    };
  }, [patientId]);

  return { latestVital, isConnected };
};