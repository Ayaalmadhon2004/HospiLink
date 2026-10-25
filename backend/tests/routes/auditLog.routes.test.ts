import { prismaMock } from '../mocks/prisma';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../src/config/jwt';
import auditLogRoutes from '../../src/routes/auditLog.routes';

const app = express();
app.use('/audit-logs', auditLogRoutes);

const as = (role: string) => {
  prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@h.com', role, hospitalId: 'hosp-1', accountStatus: 'ACTIVE' } as any);
  return `Bearer ${jwt.sign({ userId: 'u1' }, JWT_SECRET)}`;
};

describe('GET /audit-logs', () => {
  it('401 anonymous, 403 for every non-ADMIN role', async () => {
    expect((await request(app).get('/audit-logs')).status).toBe(401);
    for (const role of ['DOCTOR', 'NURSE', 'DISPATCHER']) {
      expect((await request(app).get('/audit-logs').set('Authorization', as(role))).status).toBe(403);
      expect((await request(app).get('/audit-logs/actions').set('Authorization', as(role))).status).toBe(403);
    }
    expect(prismaMock.auditLog.findMany).not.toHaveBeenCalled();
  });

  it('400 for bad filters; 200 for an ADMIN', async () => {
    expect((await request(app).get('/audit-logs?userId=nope').set('Authorization', as('ADMIN'))).status).toBe(400);
    expect((await request(app).get('/audit-logs?from=notadate').set('Authorization', as('ADMIN'))).status).toBe(400);
    prismaMock.auditLog.findMany.mockResolvedValue([]);
    prismaMock.auditLog.count.mockResolvedValue(0);
    expect((await request(app).get('/audit-logs?action=CREATE_WARD&limit=20').set('Authorization', as('ADMIN'))).status).toBe(200);
  });
});
