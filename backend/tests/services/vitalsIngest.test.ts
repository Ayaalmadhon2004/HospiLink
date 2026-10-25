import { prismaMock } from '../mocks/prisma';
import { mockRoomEmit } from '../mocks/io';
import { ingestReadings } from '../../src/services/vitalsIngest';

describe('vitalsIngest.ingestReadings', () => {
  beforeEach(() => {
    prismaMock.vitalThresholds.findMany.mockResolvedValue([]);
  });

  it('stores a normal reading scoped to the device hospital, tagged with the device as recorder', async () => {
    prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1', department: 'ICU', hospitalId: 'h1', doctor: null } as never);
    prismaMock.patientVitals.create.mockResolvedValue({ id: 'v1' } as never);
    const out = await ingestReadings('h1', 'dk1', [{ patientCode: 'P-1', values: { heartRate: 80 } }]);
    expect(out).toEqual([{ patientCode: 'P-1', status: 'stored', vitalsId: 'v1', isCritical: false }]);
    expect(prismaMock.patient.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { patientCode: 'P-1', hospitalId: 'h1', deletedAt: null } }));
    expect(prismaMock.patientVitals.create.mock.calls[0][0].data).toMatchObject({ patientId: 'p1', recordedBy: 'device:dk1', isCritical: false });
    expect(mockRoomEmit).toHaveBeenCalledWith('patient-p1', 'new-vital', { id: 'v1' });
  });

  it('a critical reading escalates the patient', async () => {
    prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1', department: 'ICU', hospitalId: 'h1', doctor: null } as never);
    prismaMock.patientVitals.create.mockResolvedValue({ id: 'v2' } as never);
    prismaMock.patient.updateMany.mockResolvedValue({ count: 1 });
    const out = await ingestReadings('h1', 'dk1', [{ patientCode: 'P-1', values: { spO2: 70 } }]);
    expect(out[0]).toMatchObject({ status: 'stored', isCritical: true });
    expect(prismaMock.patient.updateMany).toHaveBeenCalled();
  });

  it('rejects unknown patients and empty readings without failing the batch', async () => {
    prismaMock.patient.findFirst.mockResolvedValue(null);
    const out = await ingestReadings('h1', 'dk1', [
      { patientCode: 'GHOST', values: { heartRate: 80 } },
      { patientCode: 'P-1', values: {} },
    ]);
    expect(out.map((o) => (o.status === 'rejected' ? o.reason : o.status))).toEqual(['PATIENT_NOT_FOUND', 'NO_METRICS']);
    expect(prismaMock.patientVitals.create).not.toHaveBeenCalled();
  });

  it('a DB error on one reading is reported as ERROR and the next one still runs', async () => {
    prismaMock.patient.findFirst.mockRejectedValueOnce(new Error('db')).mockResolvedValueOnce({ id: 'p2', department: 'ER', hospitalId: 'h1', doctor: null } as never);
    prismaMock.patientVitals.create.mockResolvedValue({ id: 'v3' } as never);
    const out = await ingestReadings('h1', 'dk1', [
      { patientCode: 'A', values: { heartRate: 80 } },
      { patientCode: 'B', values: { heartRate: 80 } },
    ]);
    expect(out.map((o) => o.status)).toEqual(['rejected', 'stored']);
  });
});
