import { prismaMock } from '../mocks/prisma';
import { mockRoomEmit } from '../mocks/io';
import { mockRequest, mockResponse } from '../mocks/http';
import logger from '../../src/config/logger';
import {
  getThresholds,
  upsertThreshold,
  deleteThreshold,
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

  describe('recordVitals', () => {
    it('يرجع 404 لو المريض مش موجود', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(null);
      const req = mockRequest({ body: { patientId: 'ghost' } });
      const res = mockResponse();

      await recordVitals(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prismaMock.patientVitals.create).not.toHaveBeenCalled();
      expect(prismaMock.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ghost', hospitalId: 'hosp-1' } })
      );
    });

    it('يسجل القراءة كـ Critical لو تجاوزت الحد الأقصى المسموح للقسم', async () => {
      prismaMock.patient.findFirst.mockResolvedValue({ department: 'ICU' } as any);
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
      prismaMock.patient.updateMany.mockResolvedValue({ count: 1 } as any);

      const req = mockRequest({
        user: { id: 'u1', email: 'a@a.com', role: 'NURSE', hospitalId: 'hosp-1' },
        body: { patientId: 'p1', heartRate: '160', systolicBP: '120', spO2: '98', temperature: '37', respiratoryRate: '16' },
      });
      const res = mockResponse();

      await recordVitals(req, res);

      const dataArg = (prismaMock.patientVitals.create.mock.calls[0][0] as any).data;
      expect(dataArg.isCritical).toBe(true);
      expect(dataArg.alertType).toBe('HEART_RATE_HIGH');
      expect(dataArg.recordedBy).toBe('u1'); // the nurse who recorded it, from req.user.id

      const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonArg.alert).toEqual({ type: 'HEART_RATE_HIGH', message: 'Critical vital detected!', patientStatus: 'CRITICAL' });
    });

    it('يسجل القراءة كطبيعية (غير حرجة) لو كل القيم ضمن الحدود المسموحة', async () => {
      prismaMock.patient.findFirst.mockResolvedValue({ department: 'ICU' } as any);
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

    it('لو قراءة العتبات فشلت: بيسجل خطأ (مش debug) وبيحكم بالعتبات الافتراضية، فالقراءة الحرجة ما بتضيع', async () => {
      const errorLog = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1', department: 'ICU', hospitalId: 'hosp-1' } as any);
      (prismaMock as any).vitalThresholds.findMany.mockRejectedValue(new Error('table missing'));
      prismaMock.patientVitals.create.mockResolvedValue({ id: 'v3', patientId: 'p1' } as any);
      prismaMock.patient.updateMany.mockResolvedValue({ count: 1 } as any);

      const req = mockRequest({
        body: { patientId: 'p1', heartRate: '999', systolicBP: '120', spO2: '98', temperature: '37', respiratoryRate: '16' },
      });
      const res = mockResponse();

      await recordVitals(req, res);

      expect(errorLog).toHaveBeenCalledWith(expect.objectContaining({ hospitalId: 'hosp-1', department: 'ICU' }), expect.stringContaining('built-in defaults'));
      expect(res.status).toHaveBeenCalledWith(201);
      expect((res.json as jest.Mock).mock.calls[0][0].alert).toMatchObject({ type: 'HEART_RATE_HIGH' });
    });

    it('قسم بدون أي عتبات مخصصة: العتبات الافتراضية بتطلع التنبيه (ما بيسكت)', async () => {
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1', department: 'Radiology', hospitalId: 'hosp-1' } as any);
      (prismaMock as any).vitalThresholds.findMany.mockResolvedValue([]);
      prismaMock.patientVitals.create.mockResolvedValue({ id: 'v4', patientId: 'p1' } as any);
      prismaMock.patient.updateMany.mockResolvedValue({ count: 1 } as any);
      const res = mockResponse();

      await recordVitals(mockRequest({ body: { patientId: 'p1', spO2: '82' } }), res);

      expect((prismaMock.patientVitals.create.mock.calls[0][0] as any).data).toMatchObject({ isCritical: true, alertType: 'SPO2_LOW' });
      expect((res.json as jest.Mock).mock.calls[0][0].alert).toMatchObject({ type: 'SPO2_LOW' });
    });

    it('عتبة مخصصة بـ alertEnabled=false بتعطّل التنبيه لهالمؤشر (مش بترجع للافتراضي)', async () => {
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1', department: 'ICU', hospitalId: 'hosp-1' } as any);
      (prismaMock as any).vitalThresholds.findMany.mockResolvedValue([
        { id: 't1', vitalType: 'SPO2', minCritical: 90, maxCritical: null, alertEnabled: false },
      ]);
      prismaMock.patientVitals.create.mockResolvedValue({ id: 'v5', patientId: 'p1' } as any);
      const res = mockResponse();

      await recordVitals(mockRequest({ body: { patientId: 'p1', spO2: '82' } }), res);

      expect((res.json as jest.Mock).mock.calls[0][0].alert).toBeNull();
      expect(prismaMock.patient.updateMany).not.toHaveBeenCalled();
    });

    it('القراءة الحرجة بتحوّل حالة المريض لـ CRITICAL (إلا لو CRITICAL أو DISCHARGED) وبتبث الحدث', async () => {
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1', department: 'ICU', hospitalId: 'hosp-1' } as any);
      (prismaMock as any).vitalThresholds.findMany.mockResolvedValue([]);
      prismaMock.patientVitals.create.mockResolvedValue({ id: 'v6', patientId: 'p1' } as any);
      prismaMock.patient.updateMany.mockResolvedValue({ count: 1 } as any);
      const res = mockResponse();

      await recordVitals(mockRequest({ body: { patientId: 'p1', heartRate: '170' } }), res);

      expect(prismaMock.patient.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1', hospitalId: 'hosp-1', status: { notIn: ['CRITICAL', 'DISCHARGED'] } },
        data: { status: 'CRITICAL' },
      });
      expect(mockRoomEmit).toHaveBeenCalledWith('patient-p1', 'patient-status-changed', expect.objectContaining({ status: 'CRITICAL' }));
      expect(mockRoomEmit).toHaveBeenCalledWith('h-hosp-1:clinical-staff', 'patient-status-changed', expect.objectContaining({ patientId: 'p1' }));
      expect((res.json as jest.Mock).mock.calls[0][0].alert.patientStatus).toBe('CRITICAL');
    });

    it('ما بيبث ولا بيغيّر لو المريض أصلاً CRITICAL/DISCHARGED، وما بيفشل لو التصعيد فشل', async () => {
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1', department: 'ICU', hospitalId: 'hosp-1' } as any);
      (prismaMock as any).vitalThresholds.findMany.mockResolvedValue([]);
      prismaMock.patientVitals.create.mockResolvedValue({ id: 'v7', patientId: 'p1' } as any);

      prismaMock.patient.updateMany.mockResolvedValue({ count: 0 } as any);
      const res1 = mockResponse();
      await recordVitals(mockRequest({ body: { patientId: 'p1', heartRate: '170' } }), res1);
      expect(mockRoomEmit).not.toHaveBeenCalledWith(expect.anything(), 'patient-status-changed', expect.anything());
      expect((res1.json as jest.Mock).mock.calls[0][0].alert).toMatchObject({ type: 'HEART_RATE_HIGH', patientStatus: null });

      jest.spyOn(logger, 'error').mockImplementation(() => undefined);
      prismaMock.patient.updateMany.mockRejectedValue(new Error('db'));
      const res2 = mockResponse();
      await recordVitals(mockRequest({ body: { patientId: 'p1', heartRate: '170' } }), res2);
      expect(res2.status).toHaveBeenCalledWith(201);
    });

    it('°F: 104 °F (40 °C) مو حرجة، 107 °F (41.7 °C) حرجة بالعتبات الافتراضية', async () => {
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1', department: 'ICU', hospitalId: 'hosp-1' } as any);
      (prismaMock as any).vitalThresholds.findMany.mockResolvedValue([]);
      prismaMock.patientVitals.create.mockResolvedValue({ id: 'v8', patientId: 'p1' } as any);
      prismaMock.patient.updateMany.mockResolvedValue({ count: 1 } as any);

      await recordVitals(mockRequest({ body: { patientId: 'p1', temperature: '104' } }), mockResponse());
      expect((prismaMock.patientVitals.create.mock.calls[0][0] as any).data.isCritical).toBe(false);

      await recordVitals(mockRequest({ body: { patientId: 'p1', temperature: '107' } }), mockResponse());
      expect((prismaMock.patientVitals.create.mock.calls[1][0] as any).data).toMatchObject({ isCritical: true, alertType: 'TEMPERATURE_HIGH' });
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
      expect(whereArg.patient).toEqual({ hospitalId: 'hosp-1' });
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
      expect(callArg.where.patient).toEqual({ hospitalId: 'hosp-1' });
      expect(callArg.take).toBe(20);
    });
  });

  describe('getVitalsById', () => {
    it('يرجع 404 لو القراءة مش موجودة', async () => {
      (prismaMock as any).patientVitals.findFirst.mockResolvedValue(null);
      const req = mockRequest({ params: { id: 'nope' } });
      const res = mockResponse();

      await getVitalsById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateVitals', () => {
    it('يرجع 404 لو القراءة الأصلية مش موجودة', async () => {
      (prismaMock as any).patientVitals.findFirst.mockResolvedValue(null);
      const req = mockRequest({ params: { id: 'nope' }, body: {} });
      const res = mockResponse();

      await updateVitals(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('يعيد فحص الخطورة (critical) بعد التحديث بناءً على القيم الجديدة', async () => {
      (prismaMock as any).patientVitals.findFirst.mockResolvedValue({
        id: 'v1',
        heartRate: 80,
        patient: { id: 'p1', department: 'ER', hospitalId: 'hosp-1' },
      });
      prismaMock.patient.updateMany.mockResolvedValue({ count: 1 } as any);
      (prismaMock as any).vitalThresholds.findMany.mockResolvedValue([
        { vitalType: 'HEART_RATE', minCritical: 40, maxCritical: 130, department: 'ER', alertEnabled: true },
      ]);
      (prismaMock as any).patientVitals.update.mockResolvedValue({ id: 'v1', isCritical: true });

      const req = mockRequest({ params: { id: 'v1' }, body: { heartRate: 180 } });
      const res = mockResponse();

      await updateVitals(req, res);

      const dataArg = (prismaMock as any).patientVitals.update.mock.calls[0][0].data;
      expect(dataArg.isCritical).toBe(true);
      expect(prismaMock.patient.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'CRITICAL' } }));
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('deleteVitals', () => {
    it('يحذف القراءة ويرجع رسالة نجاح', async () => {
      (prismaMock as any).patientVitals.findFirst.mockResolvedValue({ id: 'v1' });
      (prismaMock as any).patientVitals.delete.mockResolvedValue({});
      const req = mockRequest({ params: { id: 'v1' } });
      const res = mockResponse();

      await deleteVitals(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('يرجع 404 لقراءة مريض من مستشفى ثاني ولا يحذف', async () => {
      (prismaMock as any).patientVitals.findFirst.mockResolvedValue(null);
      const res = mockResponse();

      await deleteVitals(mockRequest({ params: { id: 'foreign' } }), res);

      expect((prismaMock as any).patientVitals.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'foreign', patient: { hospitalId: 'hosp-1' } } })
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect((prismaMock as any).patientVitals.delete).not.toHaveBeenCalled();
    });
  });

  describe('missing / invalid metrics (no NaN)', () => {
    const hrThreshold = [
      { vitalType: 'HEART_RATE', minCritical: 40, maxCritical: 130, department: 'ICU', alertEnabled: true },
    ];
    const createdData = () => (prismaMock.patientVitals.create.mock.calls[0][0] as any).data;
    const metricKeys = ['heartRate', 'systolicBP', 'diastolicBP', 'spO2', 'temperature', 'respiratoryRate'];

    beforeEach(() => {
      prismaMock.patient.findFirst.mockResolvedValue({ department: 'ICU' } as any);
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

    it('recordVitals: missing metrics become null, invalid ones return 400', async () => {
      const res = mockResponse();
      await recordVitals(mockRequest({ body: { patientId: 'p1', heartRate: '80' } }), res);
      const data = createdData();
      expect(data.heartRate).toBe(80);
      expect(data.spO2).toBeNull();
      expect(Object.values(data).some((v) => typeof v === 'number' && Number.isNaN(v))).toBe(false);

      const res2 = mockResponse();
      await recordVitals(mockRequest({ body: { patientId: 'p1', heartRate: 'abc' } }), res2);
      expect(res2.status).toHaveBeenCalledWith(400);
    });

    it('updateVitals: only provided fields are updated; absent ones are not touched', async () => {
      (prismaMock as any).patientVitals.findFirst.mockResolvedValue({
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
      (prismaMock as any).patientVitals.findFirst.mockResolvedValue({
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

  describe('thresholds API', () => {
    it('getThresholds with a department returns the effective rules (custom + defaults, flagged by source)', async () => {
      (prismaMock as any).vitalThresholds.findMany.mockResolvedValue([
        { id: 't1', hospitalId: 'hosp-1', department: 'ICU', vitalType: 'HEART_RATE', minNormal: 50, maxNormal: 90, minCritical: 35, maxCritical: 120, alertEnabled: true, autoNotify: false },
      ]);
      const res = mockResponse();

      await getThresholds(mockRequest({ query: { department: 'ICU' } }), res);

      expect((prismaMock as any).vitalThresholds.findMany).toHaveBeenCalledWith({ where: { hospitalId: 'hosp-1', department: 'ICU' } });
      const { data, count } = (res.json as jest.Mock).mock.calls[0][0];
      expect(count).toBe(6);
      expect(data.find((r: any) => r.vitalType === 'HEART_RATE')).toMatchObject({ source: 'custom', id: 't1', maxCritical: 120 });
      expect(data.find((r: any) => r.vitalType === 'SPO2')).toMatchObject({ source: 'default', id: null, minCritical: 90 });
    });

    it('getThresholds without a department lists the custom rows of this hospital only', async () => {
      (prismaMock as any).vitalThresholds.findMany.mockResolvedValue([]);
      const res = mockResponse();
      await getThresholds(mockRequest({ query: {} }), res);
      expect((prismaMock as any).vitalThresholds.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { hospitalId: 'hosp-1' } }));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('upsertThreshold scopes the rule to the caller hospital (a body hospitalId is ignored)', async () => {
      (prismaMock as any).vitalThresholds.upsert.mockResolvedValue({ id: 't1' });
      const res = mockResponse();

      await upsertThreshold(
        mockRequest({ body: { hospitalId: 'other', department: 'ICU', vitalType: 'SPO2', minCritical: 88, alertEnabled: true } }),
        res
      );

      const arg = (prismaMock as any).vitalThresholds.upsert.mock.calls[0][0];
      expect(arg.where).toEqual({ hospitalId_department_vitalType: { hospitalId: 'hosp-1', department: 'ICU', vitalType: 'SPO2' } });
      expect(arg.create).toMatchObject({ hospitalId: 'hosp-1', department: 'ICU', vitalType: 'SPO2', minCritical: 88 });
      expect(arg.update).not.toHaveProperty('hospitalId');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('deleteThreshold removes only a rule of this hospital (404 otherwise)', async () => {
      (prismaMock as any).vitalThresholds.deleteMany.mockResolvedValue({ count: 1 });
      const res1 = mockResponse();
      await deleteThreshold(mockRequest({ params: { id: 't1' } }), res1);
      expect((prismaMock as any).vitalThresholds.deleteMany).toHaveBeenCalledWith({ where: { id: 't1', hospitalId: 'hosp-1' } });
      expect(res1.status).toHaveBeenCalledWith(200);

      (prismaMock as any).vitalThresholds.deleteMany.mockResolvedValue({ count: 0 });
      const res2 = mockResponse();
      await deleteThreshold(mockRequest({ params: { id: 'foreign' } }), res2);
      expect(res2.status).toHaveBeenCalledWith(404);
    });
  });
});
