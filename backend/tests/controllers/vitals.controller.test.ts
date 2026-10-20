import { prismaMock } from '../mocks/prisma';
import { mockRoomEmit } from '../mocks/io';
import { mockRequest, mockResponse } from '../mocks/http';
import {
  createVital,
  recordVitals,
  getVitals,
  getCriticalAlerts,
  getVitalsById,
  updateVitals,
  deleteVitals,
} from '../../src/controllers/vitals.controller';

describe('vitals.controller', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  describe('createVital', () => {
    it('ينشئ قراءة سريعة ويبثها لغرفة المريض', async () => {
      prismaMock.patientVitals.create.mockResolvedValue({
        id: 'v1',
        patientId: 'p1',
      } as any);

      const req = mockRequest({
        body: { patientId: 'p1', heartRate: '80', systolicBP: '120', spO2: '98', temperature: '37', respiratoryRate: '16' },
      });
      const res = mockResponse();

      await createVital(req, res);

      const dataArg = (prismaMock.patientVitals.create.mock.calls[0][0] as any).data;
      expect(dataArg.heartRate).toBe(80); // لازم يترحول لرقم
      expect(mockRoomEmit).toHaveBeenCalledWith('patient-p1', 'new-vital', expect.objectContaining({ id: 'v1' }));
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('recordVitals', () => {
    it('يرجع 404 لو المريض مش موجود', async () => {
      prismaMock.patient.findUnique.mockResolvedValue(null);
      const req = mockRequest({ body: { patientId: 'ghost' } });
      const res = mockResponse();

      await recordVitals(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prismaMock.patientVitals.create).not.toHaveBeenCalled();
    });

    it('يسجل القراءة كـ Critical لو تجاوزت الحد الأقصى المسموح للقسم', async () => {
      prismaMock.patient.findUnique.mockResolvedValue({ department: 'ICU' } as any);
      (prismaMock as any).vitalThresholds.findMany.mockResolvedValue([
        {
          vitalType: 'HEART_RATE',
          minCritical: 40,
          maxCritical: 130,
          department: 'ICU',
          alertEnabled: true,
        },
      ]);
      prismaMock.patientVitals.create.mockResolvedValue({ id: 'v1', patientId: 'p1' } as any);

      const req = mockRequest({
        user: { id: 'u1', email: 'a@a.com', role: 'NURSE' },
        body: { patientId: 'p1', heartRate: '160', systolicBP: '120', spO2: '98', temperature: '37', respiratoryRate: '16' },
      });
      const res = mockResponse();

      await recordVitals(req, res);

      const dataArg = (prismaMock.patientVitals.create.mock.calls[0][0] as any).data;
      expect(dataArg.isCritical).toBe(true);
      expect(dataArg.alertType).toBe('HEART_RATE_HIGH');

      const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonArg.alert).toEqual({ type: 'HEART_RATE_HIGH', message: 'Critical vital detected!' });
    });

    it('يسجل القراءة كطبيعية (غير حرجة) لو كل القيم ضمن الحدود المسموحة', async () => {
      prismaMock.patient.findUnique.mockResolvedValue({ department: 'ICU' } as any);
      (prismaMock as any).vitalThresholds.findMany.mockResolvedValue([
        { vitalType: 'HEART_RATE', minCritical: 40, maxCritical: 130, department: 'ICU', alertEnabled: true },
      ]);
      prismaMock.patientVitals.create.mockResolvedValue({ id: 'v2', patientId: 'p1' } as any);

      const req = mockRequest({
        body: { patientId: 'p1', heartRate: '75', systolicBP: '120', spO2: '98', temperature: '37', respiratoryRate: '16' },
      });
      const res = mockResponse();

      await recordVitals(req, res);

      const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonArg.alert).toBeNull();
    });

    it('ما بيفشل ولا بيعتبر القراءة حرجة لو تحقق العتبات نفسه رمى استثناء', async () => {
      prismaMock.patient.findUnique.mockResolvedValue({ department: 'ICU' } as any);
      (prismaMock as any).vitalThresholds.findMany.mockRejectedValue(new Error('table missing'));
      prismaMock.patientVitals.create.mockResolvedValue({ id: 'v3', patientId: 'p1' } as any);

      const req = mockRequest({
        body: { patientId: 'p1', heartRate: '999', systolicBP: '120', spO2: '98', temperature: '37', respiratoryRate: '16' },
      });
      const res = mockResponse();

      await recordVitals(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonArg.alert).toBeNull();
    });
  });

  describe('getVitals', () => {
    it('يفلتر على isCritical=true لو critical=true بالكويري', async () => {
      (prismaMock as any).patientVitals.findMany.mockResolvedValue([]);
      const req = mockRequest({ query: { critical: 'true' } });
      const res = mockResponse();

      await getVitals(req, res);

      const whereArg = (prismaMock as any).patientVitals.findMany.mock.calls[0][0].where;
      expect(whereArg.isCritical).toBe(true);
    });

    it('يستخدم limit افتراضي 50 لو ما تم تحديده', async () => {
      (prismaMock as any).patientVitals.findMany.mockResolvedValue([]);
      const req = mockRequest({ query: {} });
      const res = mockResponse();

      await getVitals(req, res);

      const takeArg = (prismaMock as any).patientVitals.findMany.mock.calls[0][0].take;
      expect(takeArg).toBe(50);
    });
  });

  describe('getCriticalAlerts', () => {
    it('يرجع بس القراءات الحرجة وياخد أول 20', async () => {
      (prismaMock as any).patientVitals.findMany.mockResolvedValue([]);
      const req = mockRequest({ query: {} });
      const res = mockResponse();

      await getCriticalAlerts(req, res);

      const callArg = (prismaMock as any).patientVitals.findMany.mock.calls[0][0];
      expect(callArg.where.isCritical).toBe(true);
      expect(callArg.take).toBe(20);
    });
  });

  describe('getVitalsById', () => {
    it('يرجع 404 لو القراءة مش موجودة', async () => {
      (prismaMock as any).patientVitals.findUnique.mockResolvedValue(null);
      const req = mockRequest({ params: { id: 'nope' } });
      const res = mockResponse();

      await getVitalsById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateVitals', () => {
    it('يرجع 404 لو القراءة الأصلية مش موجودة', async () => {
      (prismaMock as any).patientVitals.findUnique.mockResolvedValue(null);
      const req = mockRequest({ params: { id: 'nope' }, body: {} });
      const res = mockResponse();

      await updateVitals(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('يعيد فحص الخطورة (critical) بعد التحديث بناءً على القيم الجديدة', async () => {
      (prismaMock as any).patientVitals.findUnique.mockResolvedValue({
        id: 'v1',
        heartRate: 80,
        patient: { department: 'ER' },
      });
      (prismaMock as any).vitalThresholds.findMany.mockResolvedValue([
        { vitalType: 'HEART_RATE', minCritical: 40, maxCritical: 130, department: 'ER', alertEnabled: true },
      ]);
      (prismaMock as any).patientVitals.update.mockResolvedValue({ id: 'v1', isCritical: true });

      const req = mockRequest({ params: { id: 'v1' }, body: { heartRate: 180 } });
      const res = mockResponse();

      await updateVitals(req, res);

      const dataArg = (prismaMock as any).patientVitals.update.mock.calls[0][0].data;
      expect(dataArg.isCritical).toBe(true);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('deleteVitals', () => {
    it('يحذف القراءة ويرجع رسالة نجاح', async () => {
      (prismaMock as any).patientVitals.delete.mockResolvedValue({});
      const req = mockRequest({ params: { id: 'v1' } });
      const res = mockResponse();

      await deleteVitals(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('missing / invalid metrics (no NaN)', () => {
    const hrThreshold = [
      { vitalType: 'HEART_RATE', minCritical: 40, maxCritical: 130, department: 'ICU', alertEnabled: true },
    ];
    const createdData = () => (prismaMock.patientVitals.create.mock.calls[0][0] as any).data;
    const metricKeys = ['heartRate', 'systolicBP', 'diastolicBP', 'spO2', 'temperature', 'respiratoryRate'];

    beforeEach(() => {
      prismaMock.patient.findUnique.mockResolvedValue({ department: 'ICU' } as any);
      (prismaMock as any).vitalThresholds.findMany.mockResolvedValue(hrThreshold);
      prismaMock.patientVitals.create.mockResolvedValue({ id: 'v1', patientId: 'p1' } as any);
    });

    it('all metrics missing: stores null (never NaN) and raises no alert', async () => {
      const res = mockResponse();
      await recordVitals(mockRequest({ body: { patientId: 'p1' } }), res);

      const data = createdData();
      for (const k of metricKeys) expect(data[k]).toBeNull();
      expect(data.isCritical).toBe(false);
      expect(data.alertType).toBeNull();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('null and empty-string metrics are treated as missing', async () => {
      const res = mockResponse();
      await recordVitals(mockRequest({ body: { patientId: 'p1', heartRate: '', spO2: null, temperature: '  ' } }), res);

      const data = createdData();
      expect(data.heartRate).toBeNull();
      expect(data.spO2).toBeNull();
      expect(data.temperature).toBeNull();
    });

    it('partial metrics: provided stored, absent null, critical only from provided', async () => {
      const res = mockResponse();
      await recordVitals(mockRequest({ body: { patientId: 'p1', heartRate: 160 } }), res);

      const data = createdData();
      expect(data.heartRate).toBe(160);
      expect(data.spO2).toBeNull();
      expect(data.isCritical).toBe(true);
      expect(data.alertType).toBe('HEART_RATE_HIGH');
    });

    it('missing metric does not trigger an alert when only other metrics are provided', async () => {
      const res = mockResponse();
      await recordVitals(mockRequest({ body: { patientId: 'p1', spO2: 98 } }), res);

      const data = createdData();
      expect(data.heartRate).toBeNull();
      expect(data.isCritical).toBe(false);
      expect((res.json as jest.Mock).mock.calls[0][0].alert).toBeNull();
    });

    it('missing metric does not mask a critical metric (alert not skipped)', async () => {
      const res = mockResponse();
      await recordVitals(mockRequest({ body: { patientId: 'p1', heartRate: '20', systolicBP: '' } }), res);

      const data = createdData();
      expect(data.isCritical).toBe(true);
      expect(data.alertType).toBe('HEART_RATE_LOW');
    });

    it('string numbers are converted to numbers', async () => {
      const res = mockResponse();
      await recordVitals(
        mockRequest({ body: { patientId: 'p1', heartRate: '75', spO2: '97.5', temperature: '36.8' } }),
        res
      );

      const data = createdData();
      expect(data.heartRate).toBe(75);
      expect(data.spO2).toBe(97.5);
      expect(data.temperature).toBe(36.8);
      expect(data.isCritical).toBe(false);
    });

    it('invalid number strings return 400 and never reach Prisma', async () => {
      for (const bad of ['abc', 'NaN', 'Infinity', '12abc']) {
        const res = mockResponse();
        await recordVitals(mockRequest({ body: { patientId: 'p1', heartRate: bad } }), res);
        expect(res.status).toHaveBeenCalledWith(400);
      }
      expect(prismaMock.patientVitals.create).not.toHaveBeenCalled();
    });

    it('createVital: missing metrics become null, invalid ones return 400', async () => {
      const res = mockResponse();
      await createVital(mockRequest({ body: { patientId: 'p1', heartRate: '80' } }), res);
      const data = createdData();
      expect(data.heartRate).toBe(80);
      expect(data.spO2).toBeNull();
      expect(Object.values(data).some((v) => typeof v === 'number' && Number.isNaN(v))).toBe(false);

      const res2 = mockResponse();
      await createVital(mockRequest({ body: { patientId: 'p1', heartRate: 'abc' } }), res2);
      expect(res2.status).toHaveBeenCalledWith(400);
    });

    it('updateVitals: only provided fields are updated; absent ones are not touched', async () => {
      (prismaMock as any).patientVitals.findUnique.mockResolvedValue({
        id: 'v1', heartRate: 80, spO2: 97, patient: { department: 'ICU' },
      });
      (prismaMock as any).patientVitals.update.mockResolvedValue({ id: 'v1' });
      const res = mockResponse();
      await updateVitals(mockRequest({ params: { id: 'v1' }, body: { temperature: '37.2' } }), res);

      const data = (prismaMock as any).patientVitals.update.mock.calls[0][0].data;
      expect(data.temperature).toBe(37.2);
      expect('heartRate' in data).toBe(false);
      expect(data.isCritical).toBe(false);
    });

    it('updateVitals: stored critical value is still evaluated when not in the body', async () => {
      (prismaMock as any).patientVitals.findUnique.mockResolvedValue({
        id: 'v1', heartRate: 200, patient: { department: 'ICU' },
      });
      (prismaMock as any).patientVitals.update.mockResolvedValue({ id: 'v1' });
      await updateVitals(mockRequest({ params: { id: 'v1' }, body: { notes: 'x' } }), mockResponse());

      const data = (prismaMock as any).patientVitals.update.mock.calls[0][0].data;
      expect(data.isCritical).toBe(true);
      expect(data.notes).toBe('x');
    });

    it('updateVitals: invalid number returns 400 without updating', async () => {
      const res = mockResponse();
      await updateVitals(mockRequest({ params: { id: 'v1' }, body: { heartRate: 'abc' } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect((prismaMock as any).patientVitals.update).not.toHaveBeenCalled();
    });

    it('getVitals: safe limit parsing with defaults and cap', async () => {
      (prismaMock as any).patientVitals.findMany.mockResolvedValue([]);
      const takes: number[] = [];
      for (const limit of ['abc', '0', '-5', '', '10', '99999']) {
        await getVitals(mockRequest({ query: { limit } }), mockResponse());
        const calls = (prismaMock as any).patientVitals.findMany.mock.calls;
        takes.push(calls[calls.length - 1][0].take);
      }
      expect(takes).toEqual([50, 50, 50, 50, 10, 200]);
    });
  });
});
