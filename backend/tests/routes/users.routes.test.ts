import { prismaMock } from '../mocks/prisma';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../src/config/jwt';
import usersRoutes from '../../src/routes/users.routes';

jest.mock('../../src/middlewares/audit.middleware', () => ({ logActivity: () => (_r: any, _s: any, n: any) => n() }));
jest.mock('../../src/services/securityNotices', () => ({ sendSecurityNotice: jest.fn() }));

const app = express();
app.use(express.json());
app.use('/users', usersRoutes);

const U2 = '3f2b8c1e-6f0a-4a57-9a39-1c1d8b3f7a10';
const as = (role: string) => {
  prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@h.com', role, hospitalId: 'hosp-1', accountStatus: 'ACTIVE' } as any);
  return `Bearer ${jwt.sign({ userId: 'u1' }, JWT_SECRET)}`;
};

describe('PUT /users/:id/role and /activate', () => {
  it.each(['role', 'activate'])('%s: 403 for non-admins, 400 for an invalid role, nothing written', async (action) => {
    for (const r of ['DOCTOR', 'NURSE', 'DISPATCHER']) {
      expect((await request(app).put(`/users/${U2}/${action}`).set('Authorization', as(r)).send({ role: 'ADMIN' })).status).toBe(403);
    }
    expect((await request(app).put(`/users/${U2}/${action}`).set('Authorization', as('ADMIN')).send({ role: 'ROOT' })).status).toBe(400);
    expect((await request(app).put(`/users/${U2}/${action}`).set('Authorization', as('ADMIN')).send({})).status).toBe(400);
    expect((await request(app).put(`/users/nope/${action}`).set('Authorization', as('ADMIN')).send({ role: 'NURSE' })).status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
