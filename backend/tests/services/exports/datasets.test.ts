import { prismaMock } from '../../mocks/prisma';
import { LOADERS } from '../../../src/services/exports/datasets';

const range = { from: new Date('2026-01-01T00:00:00Z'), to: new Date('2026-02-01T00:00:00Z') };

describe('export datasets are tenant-scoped, soft-delete aware and capped', () => {
  it('patients: hospital + not deleted + admission in the half-open range, take = cap', async () => {
    prismaMock.patient.findMany.mockResolvedValue([
      { patientCode: 'PT-1', name: 'Ali', age: 40, gender: 'MALE', status: 'STABLE', department: 'ICU', diagnosis: 'x', admissionDate: new Date(), dischargeDate: null, doctor: { name: 'Dr A' }, bed: { bedNumber: 'B1', ward: { name: 'W1' } } },
      { patientCode: 'PT-2', name: 'Sara', age: 30, gender: 'FEMALE', status: 'STABLE', department: 'ER', diagnosis: 'y', admissionDate: new Date(), dischargeDate: null, doctor: null, bed: null },
    ] as any);
    const d = await LOADERS.patients('hosp-1', range, 101);
    const arg = prismaMock.patient.findMany.mock.calls[0][0] as any;
    expect(arg.where).toEqual({ hospitalId: 'hosp-1', deletedAt: null, admissionDate: { gte: range.from, lt: range.to } });
    expect(arg.take).toBe(101);
    expect(d.rows[0]).toMatchObject({ doctor: 'Dr A', bed: 'W1 / B1' });
    expect(d.rows[1]).toMatchObject({ doctor: null, bed: null });
  });

  it('appointments and vitals are scoped through the patient', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([]);
    prismaMock.patientVitals.findMany.mockResolvedValue([]);
    await LOADERS.appointments('hosp-1', range, 5);
    await LOADERS.vitals('hosp-1', range, 5);
    expect((prismaMock.appointment.findMany.mock.calls[0][0] as any).where).toEqual({ patient: { hospitalId: 'hosp-1', deletedAt: null }, scheduledAt: { gte: range.from, lt: range.to } });
    expect((prismaMock.patientVitals.findMany.mock.calls[0][0] as any).where).toEqual({ patient: { hospitalId: 'hosp-1', deletedAt: null }, recordedAt: { gte: range.from, lt: range.to } });
  });

  it('vitals never export who recorded them, billing computes the balance (void owes nothing)', async () => {
    prismaMock.patientVitals.findMany.mockResolvedValue([]);
    await LOADERS.vitals('hosp-1', range, 5);
    expect(JSON.stringify((prismaMock.patientVitals.findMany.mock.calls[0][0] as any).select)).not.toContain('recordedBy');

    const base = { currency: 'USD', createdAt: new Date(), issuedAt: null, patient: { name: 'Ali', patientCode: 'PT-1' }, discountMinor: 0 };
    prismaMock.invoice.findMany.mockResolvedValue([
      { ...base, number: 'INV-1', status: 'ISSUED', totalMinor: 1000, paidMinor: 400 },
      { ...base, number: 'INV-2', status: 'VOID', totalMinor: 500, paidMinor: 0 },
    ] as any);
    const d = await LOADERS.billing('hosp-1', range, 5);
    expect((prismaMock.invoice.findMany.mock.calls[0][0] as any).where).toEqual({ hospitalId: 'hosp-1', patient: { deletedAt: null }, createdAt: { gte: range.from, lt: range.to } });
    expect(d.rows.map((r) => r.balanceMinor)).toEqual([600, 0]);
  });
});
