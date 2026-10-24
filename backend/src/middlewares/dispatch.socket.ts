import { Socket } from 'socket.io';
import prisma from '../config/db';
import type { UnitStatus } from '@prisma/client';
import { hasRole, socketHospitalId } from './socket.auth';
import { dispatchRoom, unitRoom } from '../utils/tenant';
import logger from '../config/logger';

const isDev = process.env.NODE_ENV !== 'production';
const log = (...args: unknown[]) => {
  if (isDev) logger.debug(args.join(' '));
};

const DISPATCH_ROLES = ['ADMIN', 'DISPATCHER'];
// A location ping may move a unit between on-the-road states, but never free it: AVAILABLE / OFF_DUTY
// would contradict a unit that is on a call (use PUT /dispatch/units/:id/status, which enforces that).
const MOVING_STATUSES: readonly UnitStatus[] = ['EN_ROUTE', 'ON_SCENE', 'TRANSPORTING', 'AT_HOSPITAL'];
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
    const hospitalId = socketHospitalId(socket);
    if (!hospitalId) return;
    socket.join(dispatchRoom(hospitalId));
    log(`Socket ${socket.id} joined dispatch-room`);
  });

  socket.on('track-unit', async (unitId: unknown) => {
    if (!hasRole(socket, ...DISPATCH_JOIN_ROLES)) return;
    if (!isNonEmptyString(unitId)) return;
    const hospitalId = socketHospitalId(socket);
    if (!hospitalId) return;
    try {
      // Only units of the user's own hospital can be tracked.
      const unit = await prisma.dispatchUnit.findFirst({ where: { id: unitId, hospitalId }, select: { id: true } });
      if (!unit) return;
      socket.join(unitRoom(hospitalId, unitId));
      log(`Socket ${socket.id} tracking unit-${unitId}`);
    } catch (error) {
      if (isDev) logger.error({ err: error }, 'Failed to join unit room');
    }
  });

  socket.on('unit-location-update', async (data: unknown) => {
    if (!hasRole(socket, ...DISPATCH_ROLES)) return;
    const d = data as { unitId?: unknown; lat?: unknown; lng?: unknown; status?: unknown } | null;
    if (!d || typeof d !== 'object') return;
    if (!isNonEmptyString(d.unitId) || !isFiniteNumber(d.lat) || !isFiniteNumber(d.lng)) return;
    if (d.lat < -90 || d.lat > 90 || d.lng < -180 || d.lng > 180) return;
    if (d.status !== undefined && !MOVING_STATUSES.includes(d.status as UnitStatus)) return;
    const hospitalId = socketHospitalId(socket);
    if (!hospitalId) return;

    try {
      const unitId = d.unitId;
      const { count } = await prisma.dispatchUnit.updateMany({
        where: { id: unitId, hospitalId },
        data: {
          location: JSON.stringify({ lat: d.lat, lng: d.lng }),
          status: d.status as UnitStatus | undefined,
          lastUpdated: new Date(),
        },
      });
      if (count === 0) return; // not a unit of this hospital
      // Tracking: everyone in the dispatch room and the ones following this unit see the new position.
      socket
        .to(dispatchRoom(hospitalId))
        .to(unitRoom(hospitalId, unitId))
        .emit('unit-location', { unitId, lat: d.lat, lng: d.lng, status: d.status, timestamp: new Date() });
    } catch (error) {
      if (isDev) logger.error({ err: error }, 'Failed to update unit location');
    }
  });

  socket.on('leave-dispatch', () => {
    const hospitalId = socketHospitalId(socket);
    if (hospitalId) socket.leave(dispatchRoom(hospitalId));
  });

  socket.on('untrack-unit', (unitId: unknown) => {
    if (!isNonEmptyString(unitId)) return;
    const hospitalId = socketHospitalId(socket);
    if (hospitalId) socket.leave(unitRoom(hospitalId, unitId));
  });
};
