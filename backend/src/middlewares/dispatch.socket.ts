// src/middlewares/dispatch.socket.ts
import { Server, Socket } from 'socket.io';
import prisma from '../config/db';

export const setupDispatchSockets = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('🚑 Dispatch socket connected:', socket.id);

    // الانضمام لغرفة الديسباتش العامة
    socket.on('join-dispatch', () => {
      socket.join('dispatch-room');
      console.log(`Socket ${socket.id} joined dispatch-room`);
    });

    // الانضمام لغرفة قسم محدد
    socket.on('join-department', (department: string) => {
      socket.join(`department-${department}`);
      console.log(`Socket ${socket.id} joined department-${department}`);
    });

    // الانضمام لمتابعة وحدة محددة
    socket.on('track-unit', (unitId: string) => {
      socket.join(`unit-${unitId}`);
      console.log(`Socket ${socket.id} tracking unit-${unitId}`);
    });

    // تحديث موقع الوحدة (من الجوال/جهاز GPS)
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
            status: data.status || undefined,
            lastUpdated: new Date()
          }
        });

        // بث الموقع لكل المتابعين
        io.to('dispatch-room').emit('unit-location', {
          unitId: data.unitId,
          lat: data.lat,
          lng: data.lng,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Failed to update unit location:', error);
      }
    });

    // مغادرة الغرف
    socket.on('leave-dispatch', () => {
      socket.leave('dispatch-room');
    });

    socket.on('leave-department', (department: string) => {
      socket.leave(`department-${department}`);
    });

    socket.on('untrack-unit', (unitId: string) => {
      socket.leave(`unit-${unitId}`);
    });

    socket.on('disconnect', () => {
      console.log('🚑 Dispatch socket disconnected:', socket.id);
    });
  });
};