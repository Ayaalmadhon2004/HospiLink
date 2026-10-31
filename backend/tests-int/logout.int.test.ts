// Logout revokes the presented JWT server-side (RevokedToken) on a real database: a stolen copy stops working on REST and sockets.
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Socket } from 'socket.io';
import { prisma, resetDb, closeDb } from './helpers/db';
import { makeWorld } from './helpers/factories';
import authRoutes from '../src/routes/auth';
import { errorEnvelope } from '../src/utils/apiResponse';
import { errorHandler } from '../src/middlewares/error.middleware';
import { generateToken } from '../src/controllers/auth.controller';
import { socketAuth } from '../src/middlewares/socket.auth';
import { JWT_SECRET } from '../src/config/jwt';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(errorEnvelope);
app.use('/api/auth', authRoutes);
app.use(errorHandler);

const me = (token: string) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
const logout = (token: string) => request(app).post('/api/auth/logout').set('Cookie', `token=${token}`);
const handshake = (token: string) =>
  new Promise<Error | undefined>((resolve) => {
    void socketAuth({ handshake: { auth: { token }, headers: {} }, data: {} } as unknown as Socket, (err) => resolve(err));
  });

afterAll(closeDb);
beforeEach(resetDb);

describe('logout revocation', () => {
  it('kills the token for REST and sockets, only that token, idempotently', async () => {
    const w = await makeWorld();
    const u = { id: w.doctor.id, email: w.doctor.email, role: 'DOCTOR' };
    const t1 = generateToken(u, { jwt: '1h' });
    const t2 = generateToken(u, { jwt: '1h' });

    expect((await me(t1)).status).toBe(200);
    expect(await handshake(t1)).toBeUndefined();

    expect((await logout(t1)).status).toBe(200);
    expect((await logout(t1)).status).toBe(200); // idempotent
    expect(await prisma.revokedToken.count()).toBe(1);

    expect((await me(t1)).status).toBe(401);
    expect(await handshake(t1)).toBeInstanceOf(Error);
    // another session of the same user is untouched
    expect((await me(t2)).status).toBe(200);
  });

  it('keeps tokens issued before the deploy (no jti) working, and ignores them on logout', async () => {
    const w = await makeWorld();
    const legacy = jwt.sign({ userId: w.doctor.id }, JWT_SECRET, { expiresIn: '1h' });
    expect((await logout(legacy)).status).toBe(200);
    expect(await prisma.revokedToken.count()).toBe(0);
    expect((await me(legacy)).status).toBe(200);
  });

  it('purges expired rows on logout', async () => {
    const w = await makeWorld();
    await prisma.revokedToken.create({ data: { jti: 'old', expiresAt: new Date(Date.now() - 60_000) } });
    await logout(generateToken({ id: w.doctor.id, email: w.doctor.email, role: 'DOCTOR' }, { jwt: '1h' }));
    expect(await prisma.revokedToken.findUnique({ where: { jti: 'old' } })).toBeNull();
    expect(await prisma.revokedToken.count()).toBe(1);
  });
});
