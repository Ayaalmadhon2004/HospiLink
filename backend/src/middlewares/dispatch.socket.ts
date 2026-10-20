import { Socket } from 'socket.io';
import prisma from '../config/db';
import { hasRole } from './socket.auth';

const isDev = process.env.NODE_ENV !== 'production';
const log = (...args: unknown[]) => {
  if (isDev) console.log(...args);
};

const DISPATCH_ROLES = ['ADMIN', 'DISPATCHER'];
const DISPATCH_JOIN_ROLES = ['ADMIN', 'DISPATCHER', 'DOCTOR'];

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= 128;

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

// مش io.on('connection') — بس function بتضيف events على socket
export const attachDispatchEvents = (socket: Socket) => {
  log('Dispatch events attached to:', socket.id);

  socket.on('join-dispatch', () => {
    if (!hasRole(socket, ...DISPATCH_JOIN_ROLES)) return;
    socket.join('dispatch-room');
    log(`Socket ${socket.id} joined dispatch-room`);
  });

  socket.on('track-unit', (unitId: unknown) => {
    if (!hasRole(socket, ...DISPATCH_JOIN_ROLES)) return;
    if (!isNonEmptyString(unitId)) return;
    socket.join(`unit-${unitId}`);
    log(`Socket ${socket.id} tracking unit-${unitId}`);
  });

  socket.on('unit-location-update', async (data: unknown) => {
    if (!hasRole(socket, ...DISPATCH_ROLES)) return;
    const d = data as { unitId?: unknown; lat?: unknown; lng?: unknown; status?: unknown } | null;
    if (!d || typeof d !== 'object') return;
    if (!isNonEmptyString(d.unitId) || !isFiniteNumber(d.lat) || !isFiniteNumber(d.lng)) return;
    if (d.lat < -90 || d.lat > 90 || d.lng < -180 || d.lng > 180) return;
    if (d.status !== undefined && typeof d.status !== 'string') return;

    try {
      await prisma.dispatchUnit.update({
        where: { id: d.unitId },
        data: {
          location: JSON.stringify({ lat: d.lat, lng: d.lng }),
          status: (d.status as any) || undefined,
          lastUpdated: new Date(),
        },
      });
    } catch (error) {
      if (isDev) console.error('Failed to update unit location:', error);
    }
  });

  socket.on('leave-dispatch', () => {
    socket.leave('dispatch-room');
  });

  socket.on('untrack-unit', (unitId: unknown) => {
    if (!isNonEmptyString(unitId)) return;
    socket.leave(`unit-${unitId}`);
  });
};
