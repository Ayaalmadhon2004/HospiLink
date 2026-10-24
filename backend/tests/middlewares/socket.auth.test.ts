import { prismaMock } from '../mocks/prisma';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../src/config/jwt';
import { socketAuth, extractSocketToken, hasRole, joinUserRoom } from '../../src/middlewares/socket.auth';
import { attachDispatchEvents } from '../../src/middlewares/dispatch.socket';

const makeSocket = (handshake: any = {}, data: any = {}) =>
  ({ handshake: { auth: {}, headers: {}, ...handshake }, data } as any);

const validToken = (userId = 'u1') => jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });

describe('socketAuth', () => {
  it('rejects when no token', async () => {
    const next = jest.fn();
    await socketAuth(makeSocket(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('rejects invalid token', async () => {
    const next = jest.fn();
    await socketAuth(makeSocket({ auth: { token: 'garbage' } }), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('rejects when user missing in DB', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const next = jest.fn();
    await socketAuth(makeSocket({ auth: { token: validToken() } }), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('accepts token from handshake.auth and attaches user', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', role: 'ADMIN', hospitalId: 'h1', accountStatus: 'ACTIVE' } as any);
    const socket = makeSocket({ auth: { token: validToken() } });
    const next = jest.fn();
    await socketAuth(socket, next);
    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user).toEqual({ id: 'u1', role: 'ADMIN', hospitalId: 'h1' });
  });

  it('rejects a token issued before the last password change', async () => {
    const old = jwt.sign({ userId: 'u1', iat: Math.floor(Date.now() / 1000) - 3600 }, JWT_SECRET);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1', role: 'ADMIN', hospitalId: 'h1', accountStatus: 'ACTIVE', passwordChangedAt: new Date(),
    } as any);
    const socket = makeSocket({ auth: { token: old } });
    const next = jest.fn();
    await socketAuth(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(socket.data.user).toBeUndefined();
  });

  it.each(['PENDING', 'DISABLED'])('rejects %s accounts', async (accountStatus) => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', role: 'NURSE', hospitalId: 'h1', accountStatus } as any);
    const socket = makeSocket({ auth: { token: validToken() } });
    const next = jest.fn();
    await socketAuth(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(socket.data.user).toBeUndefined();
  });

  it('accepts token from cookie header', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', role: 'NURSE', hospitalId: 'h1', accountStatus: 'ACTIVE' } as any);
    const socket = makeSocket({ headers: { cookie: `a=b; token=${validToken()}; c=d` } });
    const next = jest.fn();
    await socketAuth(socket, next);
    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user.role).toBe('NURSE');
  });

  it('extractSocketToken returns undefined without sources', () => {
    expect(extractSocketToken(makeSocket({ headers: { cookie: 'x=1' } }))).toBeUndefined();
  });
});

describe('dispatch socket handlers', () => {
  const setup = (role?: string) => {
    const handlers: Record<string, (...a: any[]) => any> = {};
    const socket: any = {
      id: 's1',
      data: role ? { user: { id: 'u1', role, hospitalId: 'h1' } } : {},
      on: jest.fn((e, h) => { handlers[e] = h; }),
      join: jest.fn(),
      leave: jest.fn(),
    };
    // socket.to(a).to(b).emit(...) -> recorded in `rooms` / `emitted`
    const rooms: string[] = [];
    const emitted: Array<{ event: string; payload: any }> = [];
    const chain: any = {
      to: jest.fn((room: string) => { rooms.push(room); return chain; }),
      emit: jest.fn((event: string, payload: any) => { emitted.push({ event, payload }); }),
    };
    socket.to = chain.to;
    attachDispatchEvents(socket);
    return { socket, handlers, rooms, emitted };
  };

  it('hasRole false without user', () => {
    expect(hasRole(makeSocket(), 'ADMIN')).toBe(false);
  });

  it('NURSE cannot join dispatch or update location', async () => {
    const { socket, handlers } = setup('NURSE');
    handlers['join-dispatch']();
    handlers['track-unit']('u1');
    await handlers['unit-location-update']({ unitId: 'u1', lat: 1, lng: 2 });
    expect(socket.join).not.toHaveBeenCalled();
    expect(prismaMock.dispatchUnit.updateMany).not.toHaveBeenCalled();
  });

  it('DOCTOR can join but not update location', async () => {
    const { socket, handlers } = setup('DOCTOR');
    handlers['join-dispatch']();
    expect(socket.join).toHaveBeenCalledWith('h-h1:dispatch-room');
    await handlers['unit-location-update']({ unitId: 'u1', lat: 1, lng: 2 });
    expect(prismaMock.dispatchUnit.updateMany).not.toHaveBeenCalled();
  });

  it('DISPATCHER updates with valid payload, rejects invalid', async () => {
    const { handlers } = setup('DISPATCHER');
    prismaMock.dispatchUnit.updateMany.mockResolvedValue({ count: 1 } as any);
    await handlers['unit-location-update']({ unitId: 'u1', lat: 31.9, lng: 35.9 });
    expect(prismaMock.dispatchUnit.updateMany).toHaveBeenCalledTimes(1);
    // only a unit of the socket user's own hospital can be updated
    expect(prismaMock.dispatchUnit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1', hospitalId: 'h1' } })
    );
    await handlers['unit-location-update']({ unitId: 5, lat: 1, lng: 2 });
    await handlers['unit-location-update']({ unitId: 'u1', lat: '1', lng: 2 });
    await handlers['unit-location-update']({ unitId: 'u1', lat: NaN, lng: 2 });
    await handlers['unit-location-update'](null);
    expect(prismaMock.dispatchUnit.updateMany).toHaveBeenCalledTimes(1);
  });

  it('broadcasts the new position to the dispatch room and the unit room (tracking), not to other hospitals', async () => {
    const { handlers, rooms, emitted } = setup('DISPATCHER');
    prismaMock.dispatchUnit.updateMany.mockResolvedValue({ count: 1 } as any);

    await handlers['unit-location-update']({ unitId: 'u1', lat: 31.9, lng: 35.9, status: 'EN_ROUTE' });

    expect(rooms).toEqual(['h-h1:dispatch-room', 'h-h1:unit-u1']);
    expect(emitted).toEqual([
      { event: 'unit-location', payload: expect.objectContaining({ unitId: 'u1', lat: 31.9, lng: 35.9, status: 'EN_ROUTE' }) },
    ]);
  });

  it('does not broadcast when no unit of this hospital was updated', async () => {
    const { handlers, emitted } = setup('DISPATCHER');
    prismaMock.dispatchUnit.updateMany.mockResolvedValue({ count: 0 } as any);
    await handlers['unit-location-update']({ unitId: 'foreign', lat: 1, lng: 2 });
    expect(emitted).toEqual([]);
  });

  it('a location ping can never free a unit: AVAILABLE / OFF_DUTY / unknown statuses are ignored', async () => {
    const { handlers } = setup('DISPATCHER');
    prismaMock.dispatchUnit.updateMany.mockResolvedValue({ count: 1 } as any);
    for (const status of ['AVAILABLE', 'OFF_DUTY', 'HACKED', 5]) {
      await handlers['unit-location-update']({ unitId: 'u1', lat: 1, lng: 2, status });
    }
    expect(prismaMock.dispatchUnit.updateMany).not.toHaveBeenCalled();
    await handlers['unit-location-update']({ unitId: 'u1', lat: 1, lng: 2, status: 'ON_SCENE' });
    expect(prismaMock.dispatchUnit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ON_SCENE' }) })
    );
  });

  it('track-unit validates unitId type and hospital ownership', async () => {
    const { socket, handlers } = setup('ADMIN');
    await handlers['track-unit']({ $ne: 1 });
    expect(socket.join).not.toHaveBeenCalled();

    prismaMock.dispatchUnit.findFirst.mockResolvedValue(null); // unit of another hospital
    await handlers['track-unit']('foreign');
    expect(prismaMock.dispatchUnit.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'foreign', hospitalId: 'h1' } })
    );
    expect(socket.join).not.toHaveBeenCalled();

    prismaMock.dispatchUnit.findFirst.mockResolvedValue({ id: 'abc' } as any);
    await handlers['track-unit']('abc');
    expect(socket.join).toHaveBeenCalledWith('h-h1:unit-abc');
  });
});

describe('joinUserRoom', () => {
  it('joins user-<id> room for an authenticated socket', () => {
    const socket = { ...makeSocket({}, { user: { id: 'u1', role: 'NURSE' } }), join: jest.fn() };
    expect(joinUserRoom(socket)).toBe('user-u1');
    expect(socket.join).toHaveBeenCalledWith('user-u1');
  });

  it('does not join when socket has no user', () => {
    const socket = { ...makeSocket(), join: jest.fn() };
    expect(joinUserRoom(socket)).toBeNull();
    expect(socket.join).not.toHaveBeenCalled();
  });
});

describe('joinClinicalRoom', () => {
  const { joinClinicalRoom } = require('../../src/middlewares/socket.auth');
  const sockWith = (role: string) => ({ data: { user: { id: 'u1', role, hospitalId: 'h1' } }, join: jest.fn() }) as any;

  it.each(['ADMIN', 'DOCTOR', 'NURSE'])('يضم %s لغرفة الطاقم السريري', (role) => {
    const s = sockWith(role);
    expect(joinClinicalRoom(s)).toBe(true);
    expect(s.join).toHaveBeenCalledWith('h-h1:clinical-staff');
  });

  it('ما يضم DISPATCHER', () => {
    const s = sockWith('DISPATCHER');
    expect(joinClinicalRoom(s)).toBe(false);
    expect(s.join).not.toHaveBeenCalled();
  });
});
