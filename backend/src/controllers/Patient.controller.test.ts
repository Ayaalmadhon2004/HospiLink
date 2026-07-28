import { prismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse } from '../mocks/http';
import {
  getRecentPatients,
  admitPatient,
  getPatientById,
  getPatients,
  getAvailableBeds,
  updatePatient,
  dischargePatient,
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
        expect.objectContaining({ take: 5, orderBy: { admissionDate: 'desc' } })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, count: 2, data: patients })
      );
    });
  });

  describe('admitPatient', () => {
    it('يرفض لو ما في userId بالتوكن', async () => {
      const req = mockRequest({ user: undefined, body: { name: 'Ali' } });
      const res = mockResponse();

      await admitPatient(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('يرفض لو المستخدم مش موجود بالداتابيز', async () => {
      const req = mockRequest({ user: { id: 'u1' } as any, body: {} });
      const res = mockResponse();
      prismaMock.user.findUnique.mockResolvedValue(null);

      await admitPatient(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('يرفض لو المستخدم مش مربوط بأي مستشفى', async () => {
      const req = mockRequest({ user: { id: 'u1' } as any, body: {} });
      const res = mockResponse();
      prismaMock.user.findUnique.mockResolvedValue({ hospitalId: null, name: 'Dr. A' } as any);

      await admitPatient(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('يرفض إدخال المريض لو السرير المطلوب مش موجود', async () => {
      const req = mockRequest({
        user: { id: 'u1' } as any,
        body: { name: 'Ali', age: '40', bedId: 'bed-x' },
      });
      const res = mockResponse();

      prismaMock.user.findUnique.mockResolvedValue({ hospitalId: 'h1', name: 'Dr. A' } as any);
      prismaMock.patient.count.mockResolvedValue(10);
      prismaMock.bed.findUnique.mockResolvedValue(null);

      await admitPatient(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('السرير غير موجود') })
      );
    });

    it('يرفض إدخال المريض لو السرير مش متاح', async () => {
      const req = mockRequest({
        user: { id: 'u1' } as any,
        body: { name: 'Ali', age: '40', bedId: 'bed-x' },
      });
      const res = mockResponse();

      prismaMock.user.findUnique.mockResolvedValue({ hospitalId: 'h1', name: 'Dr. A' } as any);
      prismaMock.patient.count.mockResolvedValue(10);
      prismaMock.bed.findUnique.mockResolvedValue({ id: 'bed-x', status: 'OCCUPIED' } as any);

      await admitPatient(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('غير متاح') })
      );
    });

    it('يدخل مريض جديد بنجاح ويحجز السرير (يحوله OCCUPIED)', async () => {
      const req = mockRequest({
        user: { id: 'u1' } as any,
        body: { name: 'Ali', age: '40', gender: 'MALE', department: 'ER', diagnosis: 'Flu', bedId: 'bed-x' },
      });
      const res = mockResponse();

      prismaMock.user.findUnique.mockResolvedValue({ hospitalId: 'h1', name: 'Dr. A' } as any);
      prismaMock.patient.count.mockResolvedValue(10);
      prismaMock.bed.findUnique.mockResolvedValue({ id: 'bed-x', status: 'AVAILABLE' } as any);
      prismaMock.patient.create.mockResolvedValue({ id: 'new-patient', patientCode: 'PT-2051' } as any);
      prismaMock.bed.update.mockResolvedValue({} as any);

      await admitPatient(req, res);

      expect(prismaMock.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patientCode: 'PT-2051',
            age: 40, // لازم يترحول لرقم صحيح
            bedId: 'bed-x',
            hospitalId: 'h1',
          }),
        })
      );
      expect(prismaMock.bed.update).toHaveBeenCalledWith({
        where: { id: 'bed-x' },
        data: { status: 'OCCUPIED' },
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('يدخل مريض بدون سرير (بدون bedId) بدون ما يحاول يحدث أي سرير', async () => {
      const req = mockRequest({
        user: { id: 'u1' } as any,
        body: { name: 'Ali', age: '40', gender: 'MALE', department: 'ER', diagnosis: 'Flu' },
      });
      const res = mockResponse();

      prismaMock.user.findUnique.mockResolvedValue({ hospitalId: 'h1', name: 'Dr. A' } as any);
      prismaMock.patient.count.mockResolvedValue(0);
      prismaMock.patient.create.mockResolvedValue({ id: 'new-patient' } as any);

      await admitPatient(req, res);

      expect(prismaMock.bed.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.bed.update).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('getPatientById', () => {
    it('يرجع 404 لو المريض مش موجود', async () => {
      prismaMock.patient.findUnique.mockResolvedValue(null);
      const req = mockRequest({ params: { id: 'ghost' } });
      const res = mockResponse();

      await getPatientById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('يرجع بيانات المريض لو موجود', async () => {
      prismaMock.patient.findUnique.mockResolvedValue({ id: 'p1', name: 'Ali' } as any);
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
        expect.objectContaining({ skip: 0, take: 10 })
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
      prismaMock.bed.findMany.mockResolvedValueOnce(beds as any); // أول استدعاء بدون ward
      prismaMock.bed.findFirst.mockResolvedValueOnce(beds[0] as any);
      prismaMock.bed.findMany.mockResolvedValueOnce(beds as any); // ثاني استدعاء مع ward

      const req = mockRequest({ query: {} });
      const res = mockResponse();

      await getAvailableBeds(req, res);

      const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonArg.groupedByWard.ICU).toHaveLength(2);
      expect(jsonArg.groupedByWard.ER).toHaveLength(1);
    });
  });

  describe('updatePatient', () => {
    it('يحدث بيانات المريض ويرجعها', async () => {
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

  describe('dischargePatient', () => {
    it('يرجع 404 لو المريض مش موجود', async () => {
      prismaMock.patient.findUnique.mockResolvedValue(null);
      const req = mockRequest({ params: { id: 'ghost' } });
      const res = mockResponse();

      await dischargePatient(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('يحرر السرير ويسرح المريض ضمن transaction واحدة', async () => {
      prismaMock.patient.findUnique.mockResolvedValue({ id: 'p1', bedId: 'bed-1' } as any);
      prismaMock.bed.update.mockResolvedValue({} as any);
      prismaMock.patient.update.mockResolvedValue({ id: 'p1', status: 'DISCHARGED' } as any);

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await dischargePatient(req, res);

      expect(prismaMock.bed.update).toHaveBeenCalledWith({
        where: { id: 'bed-1' },
        data: { status: 'AVAILABLE' },
      });
      expect(prismaMock.patient.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: expect.objectContaining({ status: 'DISCHARGED', bedId: null }),
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('ما بيحاول يحرر سرير لو المريض ما كان أصلاً مربوط بسرير', async () => {
      prismaMock.patient.findUnique.mockResolvedValue({ id: 'p1', bedId: null } as any);
      prismaMock.patient.update.mockResolvedValue({ id: 'p1', status: 'DISCHARGED' } as any);

      const req = mockRequest({ params: { id: 'p1' } });
      const res = mockResponse();

      await dischargePatient(req, res);

      expect(prismaMock.bed.update).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});