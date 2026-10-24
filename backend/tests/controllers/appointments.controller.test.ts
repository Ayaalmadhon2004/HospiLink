import { prismaMock } from '../mocks/prisma';
import { mockRoomEmit } from '../mocks/io';
import { mockRequest, mockResponse } from '../mocks/http';
import {
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
} from '../../src/controllers/appointments.controller';

describe('appointments.controller', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  describe('getAppointments', () => {
    it('يبني فلاتر where صح من الـ query params', async () => {
      prismaMock.appointment.findMany.mockResolvedValue([]);
      const req = mockRequest({
        query: { doctorId: 'doc-1', status: 'SCHEDULED', department: 'ER' },
      });
      const res = mockResponse();

      await getAppointments(req, res);

      const whereArg = (prismaMock.appointment.findMany.mock.calls[0][0] as any).where;
      expect(whereArg).toEqual({
        patient: { hospitalId: 'hosp-1' },
        doctorId: 'doc-1',
        status: 'SCHEDULED',
        department: 'ER',
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getAppointmentById', () => {
    it('يرجع 404 لو الموعد مش موجود', async () => {
      prismaMock.appointment.findFirst.mockResolvedValue(null);
      const req = mockRequest({ params: { id: 'nope' } });
      const res = mockResponse();

      await getAppointmentById(req, res);

      expect(prismaMock.appointment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'nope', patient: { hospitalId: 'hosp-1' } } })
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('createAppointment', () => {
    it('يفشل بشكل آمن لو ما في سياق مستشفى، ولا يختار مستشفى عشوائياً', async () => {
      const req = mockRequest({ user: undefined, body: {} });
      const res = mockResponse();

      await createAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(prismaMock.hospital.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.patient.create).not.toHaveBeenCalled();
    });

    it('يرجع 404 لو الدكتور (Staff) من مستشفى ثاني', async () => {
      prismaMock.staff.findFirst.mockResolvedValue(null);
      const req = mockRequest({
        body: { patientId: 'p1', doctorId: 'foreign-doc', scheduledAt: '2026-08-01T10:00:00Z' },
      });
      const res = mockResponse();

      await createAppointment(req, res);

      expect(prismaMock.staff.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'foreign-doc', hospitalId: 'hosp-1' } })
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(prismaMock.appointment.create).not.toHaveBeenCalled();
    });

    it('ما بيستخدم مريض من مستشفى ثاني (patientId) ولا بيفتح ملفه', async () => {
      prismaMock.staff.findFirst.mockResolvedValue({ id: 'doc-1' } as any);
      prismaMock.patient.findFirst.mockResolvedValue(null); // scoped lookup misses the foreign patient

      const req = mockRequest({
        body: { patientId: 'foreign-p', doctorId: 'doc-1', scheduledAt: '2026-08-01T10:00:00Z' },
      });
      const res = mockResponse();

      await createAppointment(req, res);

      expect(prismaMock.patient.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign-p', hospitalId: 'hosp-1' } });
      expect(res.status).toHaveBeenCalledWith(400); // no patientName -> cannot create
      expect(prismaMock.appointment.create).not.toHaveBeenCalled();
    });

    it('يستخدم مريض موجود إذا تم تمرير patientId ولا ينشئ مريض جديد', async () => {
      prismaMock.staff.findFirst.mockResolvedValue({ id: 'doc-1' } as any);
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1', name: 'Ali' } as any);
      prismaMock.appointment.findMany.mockResolvedValue([]);
      prismaMock.appointment.create.mockResolvedValue({ id: 'apt-1' } as any);

      const req = mockRequest({
        body: { patientId: 'p1', doctorId: 'doc-1', scheduledAt: '2026-08-01T10:00:00Z' },
      });
      const res = mockResponse();

      await createAppointment(req, res);

      expect(prismaMock.patient.create).not.toHaveBeenCalled();
      expect(prismaMock.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ patientId: 'p1' }) })
      );
      expect(mockRoomEmit).toHaveBeenCalledWith('h-hosp-1:clinical-staff', 'appointment-created', { id: 'apt-1' });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('يرفض إنشاء مريض جديد لو ما تم تمرير patientName', async () => {
      prismaMock.staff.findFirst.mockResolvedValue({ id: 'doc-1' } as any);
      prismaMock.patient.findFirst.mockResolvedValue(null);

      const req = mockRequest({
        body: { doctorId: 'doc-1', scheduledAt: '2026-08-01T10:00:00Z' },
      });
      const res = mockResponse();

      await createAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(prismaMock.appointment.create).not.toHaveBeenCalled();
    });

    it('ينشئ مريض جديد لو ما في patientId ولا patientCode لكن في patientName', async () => {
      prismaMock.staff.findFirst.mockResolvedValue({ id: 'doc-1' } as any);
      prismaMock.patient.create.mockResolvedValue({ id: 'new-p', name: 'Sara' } as any);
      prismaMock.appointment.findMany.mockResolvedValue([]);
      prismaMock.appointment.create.mockResolvedValue({ id: 'apt-2' } as any);

      const req = mockRequest({
        body: {
          patientName: 'Sara',
          doctorId: 'doc-1',
          scheduledAt: '2026-08-01T10:00:00Z',
        },
      });
      const res = mockResponse();

      await createAppointment(req, res);

      expect(prismaMock.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Sara', hospitalId: 'hosp-1' }) })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('يرفض بـ 409 لو في تعارض بمواعيد نفس الدكتور', async () => {
      prismaMock.staff.findFirst.mockResolvedValue({ id: 'doc-1' } as any);
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1' } as any);
      prismaMock.appointment.findMany.mockResolvedValue([
        { id: 'conflicting-apt', scheduledAt: new Date('2026-08-01T10:00:00Z'), duration: 30 },
      ] as any);

      const req = mockRequest({
        body: { patientId: 'p1', doctorId: 'doc-1', scheduledAt: '2026-08-01T10:00:00Z' },
      });
      const res = mockResponse();

      await createAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(prismaMock.appointment.create).not.toHaveBeenCalled();
    });
  });

  describe('updateAppointment', () => {
    const EXISTING = {
      id: 'apt-1', doctorId: 'doc-1', scheduledAt: new Date('2026-09-01T09:00:00Z'), duration: 30, status: 'SCHEDULED',
    };

    it('يحول scheduledAt لكائن Date قبل التحديث ويبث appointment-updated', async () => {
      prismaMock.appointment.findFirst.mockResolvedValue(EXISTING as any);
      prismaMock.appointment.findMany.mockResolvedValue([]);
      prismaMock.appointment.update.mockResolvedValue({ id: 'apt-1' } as any);
      const req = mockRequest({
        params: { id: 'apt-1' },
        body: { scheduledAt: '2026-09-01T12:00:00Z', status: 'CONFIRMED' },
      });
      const res = mockResponse();

      await updateAppointment(req, res);

      const dataArg = (prismaMock.appointment.update.mock.calls[0][0] as any).data;
      expect(dataArg.scheduledAt).toBeInstanceOf(Date);
      expect(mockRoomEmit).toHaveBeenCalledWith('h-hosp-1:clinical-staff', 'appointment-updated', { id: 'apt-1' });
    });
  });

  describe('conflict checks', () => {
    const at = (iso: string, duration = 30) => ({ id: 'other', scheduledAt: new Date(iso), duration });

    it('create: un موعد طويل موجود (09:00 لمدة 120) بيتعارض مع موعد جديد 10:30 لمدة 30', async () => {
      prismaMock.staff.findFirst.mockResolvedValue({ id: 'doc-1' } as any);
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1' } as any);
      prismaMock.appointment.findMany.mockResolvedValue([at('2026-08-01T09:00:00Z', 120)] as any);
      const res = mockResponse();

      await createAppointment(
        mockRequest({ body: { patientId: 'p1', doctorId: 'doc-1', scheduledAt: '2026-08-01T10:30:00Z', duration: 30 } }),
        res
      );

      expect(res.status).toHaveBeenCalledWith(409);
      expect(prismaMock.appointment.create).not.toHaveBeenCalled();
    });

    it('create: موعد ينتهي بالضبط وقت بداية الجديد مش تعارض', async () => {
      prismaMock.staff.findFirst.mockResolvedValue({ id: 'doc-1' } as any);
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1' } as any);
      prismaMock.appointment.findMany.mockResolvedValue([at('2026-08-01T09:30:00Z', 30)] as any);
      prismaMock.appointment.create.mockResolvedValue({ id: 'apt-1' } as any);
      const res = mockResponse();

      await createAppointment(
        mockRequest({ body: { patientId: 'p1', doctorId: 'doc-1', scheduledAt: '2026-08-01T10:00:00Z' } }),
        res
      );

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('create: خسارة سباق ضد قيد قاعدة البيانات (23P01) ترجع 409 مش 500', async () => {
      prismaMock.staff.findFirst.mockResolvedValue({ id: 'doc-1' } as any);
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1' } as any);
      prismaMock.appointment.findMany.mockResolvedValue([]);
      prismaMock.appointment.create.mockRejectedValue(Object.assign(new Error('exclusion violation'), { code: '23P01' }));
      const res = mockResponse();

      await createAppointment(
        mockRequest({ body: { patientId: 'p1', doctorId: 'doc-1', scheduledAt: '2026-08-01T10:00:00Z' } }),
        res
      );

      expect(res.status).toHaveBeenCalledWith(409);
    });

    const EXISTING = {
      id: 'apt-1', doctorId: 'doc-1', scheduledAt: new Date('2026-09-01T09:00:00Z'), duration: 30, status: 'SCHEDULED',
    };

    it('update: تغيير الوقت بيفحص التعارض ويستثني الموعد نفسه', async () => {
      prismaMock.appointment.findFirst.mockResolvedValue(EXISTING as any);
      prismaMock.appointment.findMany.mockResolvedValue([at('2026-09-01T12:00:00Z', 60)] as any);
      const res = mockResponse();

      await updateAppointment(mockRequest({ params: { id: 'apt-1' }, body: { scheduledAt: '2026-09-01T12:30:00Z' } }), res);

      const where = (prismaMock.appointment.findMany.mock.calls[0][0] as any).where;
      expect(where.doctorId).toBe('doc-1');
      expect(where.id).toEqual({ not: 'apt-1' });
      expect(res.status).toHaveBeenCalledWith(409);
      expect(prismaMock.appointment.update).not.toHaveBeenCalled();
    });

    it('update: تغيير الدكتور بيفحص مواعيد الدكتور الجديد بنفس الوقت والمدة القديمة', async () => {
      prismaMock.appointment.findFirst.mockResolvedValue({ ...EXISTING, duration: 90 } as any);
      prismaMock.staff.findFirst.mockResolvedValue({ id: 'doc-2' } as any);
      prismaMock.appointment.findMany.mockResolvedValue([at('2026-09-01T10:00:00Z', 30)] as any);
      const res = mockResponse();

      await updateAppointment(mockRequest({ params: { id: 'apt-1' }, body: { doctorId: 'doc-2' } }), res);

      expect((prismaMock.appointment.findMany.mock.calls[0][0] as any).where.doctorId).toBe('doc-2');
      expect(res.status).toHaveBeenCalledWith(409); // 09:00 + 90m covers 10:00
    });

    it('update: تمديد المدة بيفحص التعارض', async () => {
      prismaMock.appointment.findFirst.mockResolvedValue(EXISTING as any);
      prismaMock.appointment.findMany.mockResolvedValue([at('2026-09-01T09:45:00Z', 30)] as any);
      const res = mockResponse();

      await updateAppointment(mockRequest({ params: { id: 'apt-1' }, body: { duration: 60 } }), res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('update: إرجاع موعد ملغي لـ SCHEDULED بيفحص التعارض', async () => {
      prismaMock.appointment.findFirst.mockResolvedValue({ ...EXISTING, status: 'CANCELLED' } as any);
      prismaMock.appointment.findMany.mockResolvedValue([at('2026-09-01T09:00:00Z', 30)] as any);
      const res = mockResponse();

      await updateAppointment(mockRequest({ params: { id: 'apt-1' }, body: { status: 'SCHEDULED' } }), res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('update: تغيير الملاحظات فقط ما بيفحص التعارض', async () => {
      prismaMock.appointment.findFirst.mockResolvedValue(EXISTING as any);
      prismaMock.appointment.update.mockResolvedValue({ id: 'apt-1' } as any);
      const res = mockResponse();

      await updateAppointment(mockRequest({ params: { id: 'apt-1' }, body: { notes: 'bring labs' } }), res);

      expect(prismaMock.appointment.findMany).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('update: إلغاء الموعد بالتعديل ما بيفحص التعارض', async () => {
      prismaMock.appointment.findFirst.mockResolvedValue(EXISTING as any);
      prismaMock.appointment.update.mockResolvedValue({ id: 'apt-1' } as any);
      const res = mockResponse();

      await updateAppointment(mockRequest({ params: { id: 'apt-1' }, body: { status: 'CANCELLED' } }), res);

      expect(prismaMock.appointment.findMany).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('update: قيد قاعدة البيانات بيرجع 409', async () => {
      prismaMock.appointment.findFirst.mockResolvedValue(EXISTING as any);
      prismaMock.appointment.findMany.mockResolvedValue([]);
      prismaMock.appointment.update.mockRejectedValue(
        Object.assign(new Error('x'), { cause: { message: 'violates exclusion constraint "appointment_no_doctor_overlap"' } })
      );
      const res = mockResponse();

      await updateAppointment(mockRequest({ params: { id: 'apt-1' }, body: { scheduledAt: '2026-09-02T09:00:00Z' } }), res);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe('appointments of another hospital', () => {
    it('updateAppointment / deleteAppointment return 404 and change nothing', async () => {
      prismaMock.appointment.findFirst.mockResolvedValue(null);

      const res1 = mockResponse();
      await updateAppointment(mockRequest({ params: { id: 'foreign' }, body: { status: 'CONFIRMED' } }), res1);
      expect(res1.status).toHaveBeenCalledWith(404);

      const res2 = mockResponse();
      await deleteAppointment(mockRequest({ params: { id: 'foreign' } }), res2);
      expect(res2.status).toHaveBeenCalledWith(404);

      expect(prismaMock.appointment.update).not.toHaveBeenCalled();
    });

    it('updateAppointment rejects a patient or doctor from another hospital', async () => {
      prismaMock.appointment.findFirst.mockResolvedValue({ id: 'apt-1' } as any);
      prismaMock.patient.findFirst.mockResolvedValue(null);
      const res1 = mockResponse();
      await updateAppointment(mockRequest({ params: { id: 'apt-1' }, body: { patientId: 'foreign-p' } }), res1);
      expect(res1.status).toHaveBeenCalledWith(404);

      prismaMock.staff.findFirst.mockResolvedValue(null);
      const res2 = mockResponse();
      await updateAppointment(mockRequest({ params: { id: 'apt-1' }, body: { doctorId: 'foreign-d' } }), res2);
      expect(res2.status).toHaveBeenCalledWith(404);
      expect(prismaMock.appointment.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteAppointment', () => {
    it('يلغي الموعد (CANCELLED) بدل ما يحذفه فعلياً', async () => {
      prismaMock.appointment.findFirst.mockResolvedValue({ id: 'apt-1' } as any);
      prismaMock.appointment.update.mockResolvedValue({ id: 'apt-1', status: 'CANCELLED' } as any);
      const req = mockRequest({ params: { id: 'apt-1' } });
      const res = mockResponse();

      await deleteAppointment(req, res);

      expect(prismaMock.appointment.update).toHaveBeenCalledWith({
        where: { id: 'apt-1' },
        data: { status: 'CANCELLED' },
      });
      expect(mockRoomEmit).toHaveBeenCalledWith('h-hosp-1:clinical-staff', 'appointment-cancelled', { id: 'apt-1' });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
