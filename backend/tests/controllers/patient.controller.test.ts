import { prismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse } from '../mocks/http';
import {
  getRecentPatients,
  getCriticalPatientCount,
  getPatientFlow,
  admitPatient,
  getPatientById,
  getPatients,
  getAvailableBeds,
  updatePatient,
  dischargePatient,
  uploadReport,
  getReportFile,
  getPatientReports,
} from '../../src/controllers/patient.controller';

describe('patient.controller', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    // معظم دوال المريض بتستخدم $transaction بنمط الـ callback
    (prismaMock.$transaction as unknown as jest.Mock).mockImplementation((cb: any) =>
      typeof cb === 'function' ? cb(prismaMock) : Promise.all(cb)
    );
  });
  afterEach(() => jest.restoreAllMocks());

  describe('getRecentPatients', () => {
    it('يرجع آخر 5 مرضى مرتبين حسب تاريخ الدخول', async () => {
      const patients = [{ id: 'p1' }, { id: 'p2' }];
      prismaMock.patient.findMany.mockResolvedValue(patients as any);

      const req = mockRequest();
      const res = mockResponse();

      await getRecentPatients(req, res);

      expect(prismaMock.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { hospitalId: 'hosp-1' }, take: 5, orderBy: { admissionDate: 'desc' } })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, count: 2, data: patients })
      );
    });
  });

  describe('getCriticalPatientCount', () => {
    it('returns the number of CRITICAL patients', async () => {
      prismaMock.patient.count.mockResolvedValue(4);
      const res = mockResponse();

      await getCriticalPatientCount(mockRequest(), res);

      expect(prismaMock.patient.count).toHaveBeenCalledWith({ where: { status: 'CRITICAL', hospitalId: 'hosp-1' } });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { count: 4 } });
    });

    it('returns 500 without leaking the error message', async () => {
      prismaMock.patient.count.mockRejectedValue(new Error('db secret'));
      const res = mockResponse();

      await getCriticalPatientCount(mockRequest(), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(JSON.stringify((res.json as jest.Mock).mock.calls[0][0])).not.toContain('db secret');
    });
  });

  describe('getPatientFlow', () => {
    afterEach(() => jest.useRealTimers());

    it('buckets admissions and discharges per UTC day, oldest first', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-21T10:00:00Z'));
      prismaMock.patient.findMany.mockResolvedValue([
        { admissionDate: new Date('2026-10-21T01:00:00Z'), dischargeDate: null },
        { admissionDate: new Date('2026-10-20T23:00:00Z'), dischargeDate: new Date('2026-10-21T09:00:00Z') },
        { admissionDate: new Date('2026-09-01T00:00:00Z'), dischargeDate: new Date('2026-10-19T12:00:00Z') },
      ]);
      const res = mockResponse();

      await getPatientFlow(mockRequest({ query: { days: '3' } }), res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          { date: '2026-10-19', admissions: 0, discharges: 1 },
          { date: '2026-10-20', admissions: 1, discharges: 0 },
          { date: '2026-10-21', admissions: 1, discharges: 1 },
        ],
      });
    });

    it('defaults to 7 days', async () => {
      prismaMock.patient.findMany.mockResolvedValue([]);
      const res = mockResponse();

      await getPatientFlow(mockRequest(), res);

      const body = (res.json as jest.Mock).mock.calls[0][0];
      expect(body.data).toHaveLength(7);
    });

    it('returns 500 without leaking the error message', async () => {
      prismaMock.patient.findMany.mockRejectedValue(new Error('db secret'));
      const res = mockResponse();

      await getPatientFlow(mockRequest(), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(JSON.stringify((res.json as jest.Mock).mock.calls[0][0])).not.toContain('db secret');
    });
  });

  describe('admitPatient', () => {
    it('يفشل بشكل آمن (500) لو ما في سياق مستشفى بالطلب', async () => {
      const req = mockRequest({ user: undefined, body: { name: 'Ali' } });
      const res = mockResponse();

      await admitPatient(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(prismaMock.patient.create).not.toHaveBeenCalled();
    });

    it('يتجاهل hospitalId من الطلب ويستخدم مستشفى المستخدم', async () => {
      const req = mockRequest({
        body: { name: 'Ali', age: '40', gender: 'MALE', department: 'ER', diagnosis: 'Flu', hospitalId: 'other-hospital' },
      });
      const res = mockResponse();
      prismaMock.patient.count.mockResolvedValue(0);
      prismaMock.patient.create.mockResolvedValue({ id: 'new-patient' } as any);

      await admitPatient(req, res);

      const data = (prismaMock.patient.create.mock.calls[0][0] as any).data;
      expect(data.hospitalId).toBe('hosp-1');
    });

    it('يرفض سرير من مستشفى ثاني (404) بدون إنشاء مريض', async () => {
      const req = mockRequest({ body: { name: 'Ali', age: '40', bedId: 'foreign-bed' } });
      const res = mockResponse();
      prismaMock.patient.count.mockResolvedValue(0);
      prismaMock.bed.updateMany.mockResolvedValue({ count: 0 } as any);
      prismaMock.bed.findFirst.mockResolvedValue(null);

      await admitPatient(req, res);

      // the claim is scoped to the caller's hospital
      expect(prismaMock.bed.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'foreign-bed', hospitalId: 'hosp-1' }) }));
      expect(res.status).toHaveBeenCalledWith(404);
      expect(prismaMock.patient.create).not.toHaveBeenCalled();
    });

    it('يرفض دكتور من مستشفى ثاني (404)', async () => {
      const req = mockRequest({ body: { name: 'Ali', age: '40', doctorId: 'foreign-doc' } });
      const res = mockResponse();
      prismaMock.patient.count.mockResolvedValue(0);
      prismaMock.user.findFirst.mockResolvedValue(null);

      await admitPatient(req, res);

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign-doc', hospitalId: 'hosp-1' } }));
      expect(res.status).toHaveBeenCalledWith(404);
      expect(prismaMock.patient.create).not.toHaveBeenCalled();
    });

    it('يرفض إدخال المريض لو السرير المطلوب مش موجود', async () => {
      const req = mockRequest({
        body: { name: 'Ali', age: '40', bedId: 'bed-x' },
      });
      const res = mockResponse();
      prismaMock.patient.count.mockResolvedValue(10);
      prismaMock.bed.updateMany.mockResolvedValue({ count: 0 } as any);
      prismaMock.bed.findFirst.mockResolvedValue(null);

      await admitPatient(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Bed not found' });
    });

    it('يرفض إدخال المريض لو السرير مش متاح', async () => {
      const req = mockRequest({
        body: { name: 'Ali', age: '40', bedId: 'bed-x' },
      });
      const res = mockResponse();
      prismaMock.patient.count.mockResolvedValue(10);
      prismaMock.bed.updateMany.mockResolvedValue({ count: 0 } as any); // not AVAILABLE, or already has a patient
      prismaMock.bed.findFirst.mockResolvedValue({ id: 'bed-x' } as any);

      await admitPatient(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Bed is not available' });
      expect(prismaMock.patient.create).not.toHaveBeenCalled();
    });

    it('يدخل مريض جديد بنجاح ويحجز السرير (يحوله OCCUPIED)', async () => {
      const req = mockRequest({
        body: { name: 'Ali', age: '40', gender: 'MALE', department: 'ER', diagnosis: 'Flu', bedId: 'bed-x' },
      });
      const res = mockResponse();
      prismaMock.patient.count.mockResolvedValue(10);
      prismaMock.patient.aggregate.mockResolvedValue({ _max: { patientCode: null } } as any);
      prismaMock.bed.updateMany.mockResolvedValue({ count: 1 } as any);
      prismaMock.patient.create.mockResolvedValue({ id: 'new-patient', patientCode: 'PT-2051' } as any);

      await admitPatient(req, res);

      expect(prismaMock.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patientCode: 'PT-2051',
            age: 40, // لازم يترحول لرقم صحيح
            bedId: 'bed-x',
            hospitalId: 'hosp-1',
          }),
        })
      );
      // atomic claim: only a free AVAILABLE bed with nobody in it becomes OCCUPIED
      expect(prismaMock.bed.updateMany).toHaveBeenCalledWith({
        where: { id: 'bed-x', hospitalId: 'hosp-1', status: 'AVAILABLE', patient: { is: null } },
        data: { status: 'OCCUPIED' },
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('يدخل مريض بدون سرير (بدون bedId) بدون ما يحاول يحدث أي سرير', async () => {
      const req = mockRequest({
        body: { name: 'Ali', age: '40', gender: 'MALE', department: 'ER', diagnosis: 'Flu' },
      });
      const res = mockResponse();
      prismaMock.patient.count.mockResolvedValue(0);
      prismaMock.patient.create.mockResolvedValue({ id: 'new-patient' } as any);

      await admitPatient(req, res);

      expect(prismaMock.bed.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.bed.updateMany).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('admitPatient patientCode', () => {
    const admitReq = () =>
      mockRequest({
        body: { name: 'Ali', age: '40', gender: 'MALE', department: 'ER', diagnosis: 'Flu' },
      });

    beforeEach(() => {
    });

    it('يبدأ بعد أعلى كود موجود لما العدد أقل منه (seed)', async () => {
      prismaMock.patient.count.mockResolvedValue(8);
      prismaMock.patient.aggregate.mockResolvedValue({ _max: { patientCode: 'PT-2051' } } as any);
      prismaMock.patient.create.mockResolvedValue({ id: 'p' } as any);
      const res = mockResponse();

      await admitPatient(admitReq(), res);

      expect(prismaMock.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ patientCode: 'PT-2052' }) })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('يعيد المحاولة بالكود التالي لما يصير تعارض P2002 على patientCode', async () => {
      prismaMock.patient.count.mockResolvedValue(0);
      prismaMock.patient.aggregate.mockResolvedValue({ _max: { patientCode: null } } as any);
      prismaMock.patient.create
        .mockRejectedValueOnce({ code: 'P2002', meta: { target: ['patientCode'] } })
        .mockResolvedValueOnce({ id: 'p' } as any);
      const res = mockResponse();

      await admitPatient(admitReq(), res);

      expect(prismaMock.patient.create).toHaveBeenCalledTimes(2);
      expect(prismaMock.patient.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ patientCode: 'PT-2042' }) })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('يرجع 500 بعد استنفاد المحاولات ولا يسرّب الخطأ', async () => {
      prismaMock.patient.count.mockResolvedValue(0);
      prismaMock.patient.aggregate.mockResolvedValue({ _max: { patientCode: null } } as any);
      prismaMock.patient.create.mockRejectedValue({ code: 'P2002', meta: { target: ['patientCode'] } });
      const res = mockResponse();

      await admitPatient(admitReq(), res);

      expect(prismaMock.patient.create).toHaveBeenCalledTimes(10);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getPatientById', () => {
    it('يرجع 404 لو المريض مش موجود', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(null);
      const req = mockRequest({ params: { id: 'ghost' } });
      const res = mockResponse();

      await getPatientById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('يرجع بيانات المريض لو موجود', async () => {
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1', name: 'Ali' } as any);
      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await getPatientById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getPatients (list + pagination + filters)', () => {
    it('يستخدم page=1 و limit=10 كافتراضي', async () => {
      prismaMock.patient.findMany.mockResolvedValue([]);
      prismaMock.patient.count.mockResolvedValue(0);

      const req = mockRequest({ query: {} });
      const res = mockResponse();

      await getPatients(req, res);

      expect(prismaMock.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10, where: { hospitalId: 'hosp-1' } })
      );
    });

    it('بيحسب skip صح حسب رقم الصفحة', async () => {
      prismaMock.patient.findMany.mockResolvedValue([]);
      prismaMock.patient.count.mockResolvedValue(0);

      const req = mockRequest({ query: { page: '3', limit: '10' } });
      const res = mockResponse();

      await getPatients(req, res);

      expect(prismaMock.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 })
      );
    });

    it('بيحدد الـ limit الأقصى بـ 50 حتى لو المستخدم طلب أكتر', async () => {
      prismaMock.patient.findMany.mockResolvedValue([]);
      prismaMock.patient.count.mockResolvedValue(0);

      const req = mockRequest({ query: { limit: '500' } });
      const res = mockResponse();

      await getPatients(req, res);

      expect(prismaMock.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      );
    });

    it('يتجاهل status=ALL ويعتبره بدون فلترة', async () => {
      prismaMock.patient.findMany.mockResolvedValue([]);
      prismaMock.patient.count.mockResolvedValue(0);

      const req = mockRequest({ query: { status: 'ALL' } });
      const res = mockResponse();

      await getPatients(req, res);

      const whereArg = (prismaMock.patient.findMany.mock.calls[0][0] as any).where;
      expect(whereArg.status).toBeUndefined();
    });

    it('يبني بحث OR على الاسم وكود المريض لما يتم تمرير search', async () => {
      prismaMock.patient.findMany.mockResolvedValue([]);
      prismaMock.patient.count.mockResolvedValue(0);

      const req = mockRequest({ query: { search: 'ali' } });
      const res = mockResponse();

      await getPatients(req, res);

      const whereArg = (prismaMock.patient.findMany.mock.calls[0][0] as any).where;
      expect(whereArg.OR).toEqual([
        { name: { contains: 'ali', mode: 'insensitive' } },
        { patientCode: { contains: 'ali', mode: 'insensitive' } },
      ]);
    });

    it('بيحسب totalPages و hasNextPage/hasPrevPage صح', async () => {
      prismaMock.patient.findMany.mockResolvedValue([]);
      prismaMock.patient.count.mockResolvedValue(25);

      const req = mockRequest({ query: { page: '2', limit: '10' } });
      const res = mockResponse();

      await getPatients(req, res);

      const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonArg.pagination).toEqual({
        page: 2,
        limit: 10,
        totalCount: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      });
    });
  });

  describe('getAvailableBeds', () => {
    it('يرجع 500 لو فشل جلب الأسرة المتاحة أساساً', async () => {
      prismaMock.bed.findMany.mockRejectedValueOnce(new Error('DB down'));
      const req = mockRequest({ query: {} });
      const res = mockResponse();

      await getAvailableBeds(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('يجمع الأسرة حسب اسم الـ ward', async () => {
      const beds = [
        { id: 'b1', status: 'AVAILABLE', ward: { id: 'w1', name: 'ICU' } },
        { id: 'b2', status: 'AVAILABLE', ward: { id: 'w1', name: 'ICU' } },
        { id: 'b3', status: 'AVAILABLE', ward: { id: 'w2', name: 'ER' } },
      ];
      prismaMock.bed.findMany.mockResolvedValueOnce(beds as any);

      const req = mockRequest({ query: {} });
      const res = mockResponse();

      await getAvailableBeds(req, res);

      expect(prismaMock.bed.findMany).toHaveBeenCalledTimes(1);
      const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonArg.count).toBe(3);
      expect(jsonArg.groupedByWard.ICU).toHaveLength(2);
      expect(jsonArg.groupedByWard.ER).toHaveLength(1);
    });

    it('يفلتر حسب department (اسم الـ ward) داخل نفس المستشفى', async () => {
      prismaMock.bed.findMany.mockResolvedValueOnce([] as any);

      await getAvailableBeds(mockRequest({ query: { department: 'ICU' } }), mockResponse());

      expect(prismaMock.bed.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'AVAILABLE',
            hospitalId: 'hosp-1',
            ward: { name: { equals: 'ICU', mode: 'insensitive' } },
          },
        })
      );
    });

    it('بدون department ما يضيف فلتر ward', async () => {
      prismaMock.bed.findMany.mockResolvedValueOnce([] as any);

      await getAvailableBeds(mockRequest({ query: {} }), mockResponse());

      const where = (prismaMock.bed.findMany.mock.calls[0][0] as any).where;
      expect(where).toEqual({ status: 'AVAILABLE', hospitalId: 'hosp-1' });
    });
  });

  describe('updatePatient', () => {
    it('يحدث بيانات المريض ويرجعها', async () => {
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1', bedId: null, status: 'OBSERVATION' } as any);
      prismaMock.patient.update.mockResolvedValue({ id: 'p1', name: 'Updated' } as any);
      const req = mockRequest({ params: { id: 'p1' }, body: { name: 'Updated' } });
      const res = mockResponse();

      await updatePatient(req, res);

      expect(prismaMock.patient.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p1' }, data: { name: 'Updated' } })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('updatePatient bed rules (OCCUPIED <=> has a patient)', () => {
    const patientRow = (over = {}) => ({ id: 'p1', bedId: null, status: 'OBSERVATION', ...over });
    const run = async (body: object, existing = patientRow()) => {
      prismaMock.patient.findFirst.mockResolvedValue(existing as any);
      prismaMock.bed.updateMany.mockResolvedValue({ count: 1 } as any);
      prismaMock.patient.update.mockResolvedValue({ id: 'p1' } as any);
      const res = mockResponse();
      await updatePatient(mockRequest({ params: { id: 'p1' }, body }), res);
      return res;
    };

    it('giving a patient a bed claims it (OCCUPIED) in the same transaction', async () => {
      const res = await run({ bedId: 'bed-new' });

      expect(prismaMock.bed.updateMany).toHaveBeenCalledWith({
        where: { id: 'bed-new', hospitalId: 'hosp-1', status: 'AVAILABLE', patient: { is: null } },
        data: { status: 'OCCUPIED' },
      });
      expect(prismaMock.patient.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ bedId: 'bed-new' }) }));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('moving to another bed claims the new one and frees the old one', async () => {
      await run({ bedId: 'bed-new' }, patientRow({ bedId: 'bed-old' }));

      expect(prismaMock.bed.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: { status: 'OCCUPIED' } }));
      expect(prismaMock.bed.updateMany).toHaveBeenNthCalledWith(2, { where: { id: 'bed-old', hospitalId: 'hosp-1' }, data: { status: 'AVAILABLE' } });
    });

    it('bedId null frees the old bed; an unchanged bedId touches no bed', async () => {
      await run({ bedId: null }, patientRow({ bedId: 'bed-old' }));
      expect(prismaMock.bed.updateMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.bed.updateMany).toHaveBeenCalledWith({ where: { id: 'bed-old', hospitalId: 'hosp-1' }, data: { status: 'AVAILABLE' } });
      expect(prismaMock.patient.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ bedId: null }) }));

      prismaMock.bed.updateMany.mockClear();
      await run({ bedId: 'bed-old', name: 'X' }, patientRow({ bedId: 'bed-old' }));
      expect(prismaMock.bed.updateMany).not.toHaveBeenCalled();
    });

    it('409 when the target bed is taken or not available, and nothing is changed', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(patientRow({ bedId: 'bed-old' }) as any);
      prismaMock.bed.updateMany.mockResolvedValue({ count: 0 } as any);
      prismaMock.bed.findFirst.mockResolvedValue({ id: 'bed-new' } as any);
      const res = mockResponse();

      await updatePatient(mockRequest({ params: { id: 'p1' }, body: { bedId: 'bed-new' } }), res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(prismaMock.bed.updateMany).toHaveBeenCalledTimes(1); // the old bed was NOT released
      expect(prismaMock.patient.update).not.toHaveBeenCalled();
    });

    it('status DISCHARGED through update frees the bed and stamps dischargeDate', async () => {
      await run({ status: 'DISCHARGED' }, patientRow({ bedId: 'bed-old' }));

      expect(prismaMock.bed.updateMany).toHaveBeenCalledWith({ where: { id: 'bed-old', hospitalId: 'hosp-1' }, data: { status: 'AVAILABLE' } });
      const data = (prismaMock.patient.update.mock.calls[0][0] as any).data;
      expect(data).toMatchObject({ status: 'DISCHARGED', bedId: null });
      expect(data.dischargeDate).toBeInstanceOf(Date);
    });

    it('a discharged patient cannot be given a bed (400)', async () => {
      const res = await run({ bedId: 'bed-new' }, patientRow({ status: 'DISCHARGED' }));
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prismaMock.bed.updateMany).not.toHaveBeenCalled();

      const res2 = await run({ status: 'DISCHARGED', bedId: 'bed-new' });
      expect(res2.status).toHaveBeenCalledWith(400);
    });

    it('editing other fields never touches beds', async () => {
      await run({ diagnosis: 'Flu' }, patientRow({ bedId: 'bed-old' }));
      expect(prismaMock.bed.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('updatePatient multi-tenancy', () => {
    it('يرجع 404 لمريض من مستشفى ثاني ولا يعدل شي', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(null);
      const res = mockResponse();

      await updatePatient(mockRequest({ params: { id: 'foreign' }, body: { name: 'x' } }), res);

      expect(prismaMock.patient.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign', hospitalId: 'hosp-1' } }));
      expect(res.status).toHaveBeenCalledWith(404);
      expect(prismaMock.patient.update).not.toHaveBeenCalled();
    });

    it('يرفض نقل المريض لسرير أو دكتور من مستشفى ثاني', async () => {
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1', bedId: null, status: 'OBSERVATION' } as any);
      prismaMock.bed.updateMany.mockResolvedValue({ count: 0 } as any);
      prismaMock.bed.findFirst.mockResolvedValue(null);
      const res = mockResponse();

      await updatePatient(mockRequest({ params: { id: 'p1' }, body: { bedId: 'foreign-bed' } }), res);
      expect(res.status).toHaveBeenCalledWith(404);

      prismaMock.user.findFirst.mockResolvedValue(null);
      const res2 = mockResponse();
      await updatePatient(mockRequest({ params: { id: 'p1' }, body: { doctorId: 'foreign-doc' } }), res2);
      expect(res2.status).toHaveBeenCalledWith(404);
      expect(prismaMock.patient.update).not.toHaveBeenCalled();
    });
  });

  describe('dischargePatient', () => {
    it('يرجع 404 لو المريض مش موجود', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(null);
      const req = mockRequest({ params: { id: 'ghost' } });
      const res = mockResponse();

      await dischargePatient(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('يحرر السرير ويسرح المريض ضمن transaction واحدة', async () => {
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1', bedId: 'bed-1' } as any);
      prismaMock.bed.updateMany.mockResolvedValue({ count: 1 } as any);
      prismaMock.patient.update.mockResolvedValue({ id: 'p1', status: 'DISCHARGED' } as any);

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await dischargePatient(req, res);

      expect(prismaMock.bed.updateMany).toHaveBeenCalledWith({
        where: { id: 'bed-1', hospitalId: 'hosp-1' },
        data: { status: 'AVAILABLE' },
      });
      expect(prismaMock.patient.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: expect.objectContaining({ status: 'DISCHARGED', bedId: null }),
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('ما بيحاول يحرر سرير لو المريض ما كان أصلاً مربوط بسرير', async () => {
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1', bedId: null } as any);
      prismaMock.patient.update.mockResolvedValue({ id: 'p1', status: 'DISCHARGED' } as any);

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await dischargePatient(req, res);

      expect(prismaMock.bed.updateMany).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('report files stored in the database', () => {
    it('uploadReport يحفظ الملف بالداتابيز ولا يرجع fileData بالرد', async () => {
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1' } as any);
      prismaMock.report.create.mockImplementation(async ({ data }: any) => ({ ...data, createdAt: new Date() }));
      const req = mockRequest({
        params: { id: 'p1' },
        user: { id: 'u1', email: 'a@a.com', role: 'DOCTOR', hospitalId: 'hosp-1' },
        file: { originalname: 'xray.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF') },
      } as any);
      const res = mockResponse();

      await uploadReport(req, res);

      const data = prismaMock.report.create.mock.calls[0][0].data as any;
      expect(data.uploadedBy).toBe('u1'); // who uploaded it, from req.user.id
      expect(data.fileData).toBeInstanceOf(Uint8Array);
      expect(data.fileUrl).toBe(`/api/patients/reports/${data.id}/file`);
      expect(res.status).toHaveBeenCalledWith(201);
      const body = (res.json as jest.Mock).mock.calls[0][0];
      expect(body.data.fileData).toBeUndefined();
    });

    it('uploadReport يرجع 400 بدون ملف', async () => {
      const res = mockResponse();
      await uploadReport(mockRequest({ params: { id: 'p1' } } as any), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('getPatientReports ما بيجيب fileData', async () => {
      prismaMock.report.findMany.mockResolvedValue([] as any);
      await getPatientReports(mockRequest({ params: { id: 'p1' } } as any), mockResponse());
      expect(prismaMock.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ omit: { fileData: true }, where: { patientId: 'p1', patient: { hospitalId: 'hosp-1' } } })
      );
    });

    it('getReportFile يرجع 404 لو الملف مش موجود أو لمريض من مستشفى ثاني', async () => {
      prismaMock.report.findFirst.mockResolvedValue(null);
      const res = mockResponse();
      await getReportFile(mockRequest({ params: { reportId: 'r1' } } as any), res);
      expect(prismaMock.report.findFirst).toHaveBeenCalledWith({ where: { id: 'r1', patient: { hospitalId: 'hosp-1' } } });
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('getReportFile يرجع الملف بنوعه الأصلي', async () => {
      prismaMock.report.findFirst.mockResolvedValue({
        id: 'r1', fileType: 'application/pdf', fileData: new Uint8Array([1, 2, 3]),
      } as any);
      const res = mockResponse();
      (res as any).setHeader = jest.fn();
      (res as any).send = jest.fn();
      await getReportFile(mockRequest({ params: { reportId: 'r1' } } as any), res);
      expect((res as any).setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.status).toHaveBeenCalledWith(200);
      expect((res as any).send).toHaveBeenCalled();
    });
  });
});
