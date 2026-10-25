// Real protect/authorize/validate + real controller (Prisma mocked): only an ADMIN writes wards, bodies are validated.
import { prismaMock } from '../mocks/prisma';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../src/config/jwt';
import wardRoutes from '../../src/routes/ward.routes';

jest.mock('../../src/middlewares/audit.middleware', () => ({
  logActivity: () => (_req: any, _res: any, next: any) => next(),
}));

const app = express();
app.use(express.json());
app.use('/wards', wardRoutes);

const W1 = '3f2b8c1e-6f0a-4a57-9a39-1c1d8b3f7a10';
const as = (role: string) => {
  prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@h.com', role, hospitalId: 'hosp-1', accountStatus: 'ACTIVE' } as any);
  return `Bearer ${jwt.sign({ userId: 'u1' }, JWT_SECRET)}`;
};

describe('/wards access + validation', () => {
  it.each([['POST', '/wards'], ['PUT', `/wards/${W1}`], ['DELETE', `/wards/${W1}`]])('%s %s -> 403 for a DOCTOR', async (method, url) => {
    const res = await (request(app) as any)[method.toLowerCase()](url).set('Authorization', as('DOCTOR')).send({ name: 'X' });
    expect(res.status).toBe(403);
    expect(prismaMock.ward.create).not.toHaveBeenCalled();
    expect(prismaMock.ward.update).not.toHaveBeenCalled();
    expect(prismaMock.ward.delete).not.toHaveBeenCalled();
  });

  it('GET /wards stays open to any signed-in role', async () => {
    prismaMock.ward.findMany.mockResolvedValue([]);
    expect((await request(app).get('/wards').set('Authorization', as('NURSE'))).status).toBe(200);
  });

  it('POST /wards: 401 without a token, 400 for an empty name / bad floor, 201 for an ADMIN (hospitalId stripped)', async () => {
    expect((await request(app).post('/wards').send({ name: 'ICU' })).status).toBe(401);
    expect((await request(app).post('/wards').set('Authorization', as('ADMIN')).send({ name: '  ' })).status).toBe(400);
    expect((await request(app).post('/wards').set('Authorization', as('ADMIN')).send({ name: 'ICU', floor: 'abc' })).status).toBe(400);
    prismaMock.ward.findFirst.mockResolvedValue(null);
    prismaMock.ward.create.mockResolvedValue({ id: W1, name: 'ICU' } as any);
    const res = await request(app).post('/wards').set('Authorization', as('ADMIN')).send({ name: 'ICU', floor: '3', hospitalId: 'evil' });
    expect(res.status).toBe(201);
    expect(prismaMock.ward.create.mock.calls[0][0].data).toEqual({ name: 'ICU', floor: 3, hospitalId: 'hosp-1' });
  });

  it('PUT/DELETE reject a non-uuid id with 400', async () => {
    expect((await request(app).put('/wards/nope').set('Authorization', as('ADMIN')).send({ name: 'X' })).status).toBe(400);
    expect((await request(app).delete('/wards/nope').set('Authorization', as('ADMIN'))).status).toBe(400);
  });

  it('PUT /wards/:id: floor null clears the floor (reaches the controller as null), a number sets it, absent leaves it alone', async () => {
    prismaMock.ward.findFirst.mockResolvedValue({ id: W1 } as any);
    prismaMock.ward.update.mockResolvedValue({ id: W1 } as any);
    const auth = as('ADMIN');
    expect((await request(app).put(`/wards/${W1}`).set('Authorization', auth).send({ floor: null })).status).toBe(200);
    expect(prismaMock.ward.update.mock.calls[0][0].data).toEqual({ floor: null });
    await request(app).put(`/wards/${W1}`).set('Authorization', auth).send({ floor: '4' });
    expect(prismaMock.ward.update.mock.calls[1][0].data).toEqual({ floor: 4 });
    prismaMock.ward.findFirst.mockResolvedValueOnce({ id: W1 } as any).mockResolvedValueOnce(null); // exists; the new name is free
    await request(app).put(`/wards/${W1}`).set('Authorization', auth).send({ name: 'Only name' });
    expect(prismaMock.ward.update.mock.calls[2][0].data).toEqual({ name: 'Only name' });
  });
});
