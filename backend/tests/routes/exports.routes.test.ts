import { prismaMock } from '../mocks/prisma';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';
import { JWT_SECRET } from '../../src/config/jwt';
import exportsRoutes from '../../src/routes/exports.routes';

jest.mock('../../src/middlewares/audit.middleware', () => ({ logActivity: () => (_r: any, _s: any, n: any) => n() }));

const app = express();
app.use('/exports', exportsRoutes);

const as = (role: string) => {
  prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@h.com', role, hospitalId: 'hosp-1', accountStatus: 'ACTIVE' } as any);
  return `Bearer ${jwt.sign({ userId: 'u1' }, JWT_SECRET)}`;
};

describe('GET /exports/:type', () => {
  it('401 anonymous; 403 NURSE and DISPATCHER; DOCTOR is refused billing', async () => {
    expect((await request(app).get('/exports/patients')).status).toBe(401);
    for (const r of ['NURSE', 'DISPATCHER']) expect((await request(app).get('/exports/patients').set('Authorization', as(r))).status).toBe(403);
    expect((await request(app).get('/exports/billing').set('Authorization', as('DOCTOR'))).status).toBe(403);
    expect(prismaMock.patient.findMany).not.toHaveBeenCalled();
    expect(prismaMock.invoice.findMany).not.toHaveBeenCalled();
  });

  it('400 for an unknown type, format or date', async () => {
    const auth = as('ADMIN');
    expect((await request(app).get('/exports/secrets').set('Authorization', auth)).status).toBe(400);
    expect((await request(app).get('/exports/patients?format=csv').set('Authorization', auth)).status).toBe(400);
    expect((await request(app).get('/exports/patients?from=yesterday-ish').set('Authorization', auth)).status).toBe(400);
  });

  it('end to end: a real .xlsx comes back with the hospital\'s rows only, formulas neutralised', async () => {
    prismaMock.hospital.findUnique.mockResolvedValue({ name: 'City Hospital' } as any);
    prismaMock.patient.findMany.mockResolvedValue([
      { patientCode: 'PT-1', name: '=CMD()', age: 40, gender: 'MALE', status: 'STABLE', department: 'ICU', diagnosis: 'Flu', admissionDate: new Date('2026-01-02T00:00:00Z'), dischargeDate: null, doctor: null, bed: null },
    ] as any);
    const res = await request(app).get('/exports/patients?format=xlsx').set('Authorization', as('ADMIN')).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="hospilink-patients-.*\.xlsx"/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect((prismaMock.patient.findMany.mock.calls[0][0] as any).where).toMatchObject({ hospitalId: 'hosp-1', deletedAt: null });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as ArrayBuffer);
    const ws = wb.getWorksheet('Patients')!;
    expect(ws.getRow(2).getCell(2).value).toBe("'=CMD()");
    expect(ws.rowCount).toBe(2);
  });

  it('end to end: a real PDF for billing (ADMIN)', async () => {
    prismaMock.hospital.findUnique.mockResolvedValue({ name: 'City Hospital' } as any);
    prismaMock.invoice.findMany.mockResolvedValue([]);
    const res = await request(app).get('/exports/billing?format=pdf').set('Authorization', as('ADMIN')).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });
});
