import { prismaMock } from '../mocks/prisma';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../src/config/jwt';
import { socketAuth, extractSocketToken, hasRole } from '../../src/middlewares/socket.auth';
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
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', role: 'ADMIN' } as any);
    const socket = makeSocket({ auth: { token: validToken() } });
    const next = jest.fn();
    await socketAuth(socket, next);
    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user).toEqual({ id: 'u1', role: 'ADMIN' });
  });

  it('accepts token from cookie header', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', role: 'NURSE' } as any);
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
      data: role ? { user: { id: 'u1', role } } : {},
      on: jest.fn((e, h) => { handlers[e] = h; }),
      join: jest.fn(),
      leave: jest.fn(),
    };
    attachDispatchEvents(socket);
    return { socket, handlers };
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
    expect(prismaMock.dispatchUnit.update).not.toHaveBeenCalled();
  });

  it('DOCTOR can join but not update location', async () => {
    const { socket, handlers } = setup('DOCTOR');
    handlers['join-dispatch']();
    expect(socket.join).toHaveBeenCalledWith('dispatch-room');
    await handlers['unit-location-update']({ unitId: 'u1', lat: 1, lng: 2 });
    expect(prismaMock.dispatchUnit.update).not.toHaveBeenCalled();
  });

  it('DISPATCHER updates with valid payload, rejects invalid', async () => {
    const { handlers } = setup('DISPATCHER');
    prismaMock.dispatchUnit.update.mockResolvedValue({} as any);
    await handlers['unit-location-update']({ unitId: 'u1', lat: 31.9, lng: 35.9 });
    expect(prismaMock.dispatchUnit.update).toHaveBeenCalledTimes(1);
    await handlers['unit-location-update']({ unitId: 5, lat: 1, lng: 2 });
    await handlers['unit-location-update']({ unitId: 'u1', lat: '1', lng: 2 });
    await handlers['unit-location-update']({ unitId: 'u1', lat: NaN, lng: 2 });
    await handlers['unit-location-update'](null);
    expect(prismaMock.dispatchUnit.update).toHaveBeenCalledTimes(1);
  });

  it('track-unit validates unitId type', () => {
    const { socket, handlers } = setup('ADMIN');
    handlers['track-unit']({ $ne: 1 });
    expect(socket.join).not.toHaveBeenCalled();
    handlers['track-unit']('abc');
    expect(socket.join).toHaveBeenCalledWith('unit-abc');
  });
});
