import { Server, Socket } from 'socket.io';
import prisma from '../config/db';

// مش io.on('connection') — بس function بتضيف events على socket
export const attachDispatchEvents = (socket: Socket) => {
  console.log('🚑 Dispatch events attached to:', socket.id);

  socket.on('join-dispatch', () => {
    socket.join('dispatch-room');
    console.log(`Socket ${socket.id} joined dispatch-room`);
  });

  socket.on('join-department', (department: string) => {
    socket.join(`department-${department}`);
    console.log(`Socket ${socket.id} joined department-${department}`);
  });

  socket.on('track-unit', (unitId: string) => {
    socket.join(`unit-${unitId}`);
    console.log(`Socket ${socket.id} tracking unit-${unitId}`);
  });

  socket.on('unit-location-update', async (data: {
    unitId: string;
    lat: number;
    lng: number;
    status?: string;
  }) => {
    try {
      await prisma.dispatchUnit.update({
        where: { id: data.unitId },
        data: {
          location: JSON.stringify({ lat: data.lat, lng: data.lng }),
          status: data.status as any || undefined,
          lastUpdated: new Date()
        }
      });

      // هون لازم نستخدم io مش socket — لأن بدنا نبث لكل الغرفة
      // رح نمرر io كـ parameter
    } catch (error) {
      console.error('Failed to update unit location:', error);
    }
  });

  socket.on('leave-dispatch', () => {
    socket.leave('dispatch-room');
  });

  socket.on('leave-department', (department: string) => {
    socket.leave(`department-${department}`);
  });

  socket.on('untrack-unit', (unitId: string) => {
    socket.leave(`unit-${unitId}`);
  });
};