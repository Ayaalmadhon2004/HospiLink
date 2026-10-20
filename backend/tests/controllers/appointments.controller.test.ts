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
      expect(whereArg).toEqual({ doctorId: 'doc-1', status: 'SCHEDULED', department: 'ER' });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getAppointmentById', () => {
    it('يرجع 404 لو الموعد مش موجود', async () => {
      prismaMock.appointment.findUnique.mockResolvedValue(null);
      const req = mockRequest({ params: { id: 'nope' } });
      const res = mockResponse();

      await getAppointmentById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('createAppointment', () => {
    it('يرجع خطأ لو ما في أي مستشفى بالنظام', async () => {
      prismaMock.hospital.findFirst.mockResolvedValue(null);
      const req = mockRequest({ body: {} });
      const res = mockResponse();

      await createAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(prismaMock.patient.create).not.toHaveBeenCalled();
    });

    it('يستخدم مريض موجود إذا تم تمرير patientId ولا ينشئ مريض جديد', async () => {
      prismaMock.hospital.findFirst.mockResolvedValue({ id: 'h1' } as any);
      prismaMock.patient.findUnique.mockResolvedValue({ id: 'p1', name: 'Ali' } as any);
      prismaMock.appointment.findFirst.mockResolvedValue(null);
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
      expect(mockRoomEmit).toHaveBeenCalledWith('clinical-staff', 'appointment-created', { id: 'apt-1' });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('يرفض إنشاء مريض جديد لو ما تم تمرير patientName', async () => {
      prismaMock.hospital.findFirst.mockResolvedValue({ id: 'h1' } as any);
      prismaMock.patient.findUnique.mockResolvedValue(null);

      const req = mockRequest({
        body: { doctorId: 'doc-1', scheduledAt: '2026-08-01T10:00:00Z' },
      });
      const res = mockResponse();

      await createAppointment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(prismaMock.appointment.create).not.toHaveBeenCalled();
    });

    it('ينشئ مريض جديد لو ما في patientId ولا patientCode لكن في patientName', async () => {
      prismaMock.hospital.findFirst.mockResolvedValue({ id: 'h1' } as any);
      prismaMock.patient.create.mockResolvedValue({ id: 'new-p', name: 'Sara' } as any);
      prismaMock.appointment.findFirst.mockResolvedValue(null);
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
        expect.objectContaining({ data: expect.objectContaining({ name: 'Sara', hospitalId: 'h1' }) })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('يرفض بـ 409 لو في تعارض بمواعيد نفس الدكتور', async () => {
      prismaMock.hospital.findFirst.mockResolvedValue({ id: 'h1' } as any);
      prismaMock.patient.findUnique.mockResolvedValue({ id: 'p1' } as any);
      prismaMock.appointment.findFirst.mockResolvedValue({ id: 'conflicting-apt' } as any);

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
    it('يحول scheduledAt لكائن Date قبل التحديث ويبث appointment-updated', async () => {
      prismaMock.appointment.update.mockResolvedValue({ id: 'apt-1' } as any);
      const req = mockRequest({
        params: { id: 'apt-1' },
        body: { scheduledAt: '2026-09-01T12:00:00Z', status: 'CONFIRMED' },
      });
      const res = mockResponse();

      await updateAppointment(req, res);

      const dataArg = (prismaMock.appointment.update.mock.calls[0][0] as any).data;
      expect(dataArg.scheduledAt).toBeInstanceOf(Date);
      expect(mockRoomEmit).toHaveBeenCalledWith('clinical-staff', 'appointment-updated', { id: 'apt-1' });
    });
  });

  describe('deleteAppointment', () => {
    it('يلغي الموعد (CANCELLED) بدل ما يحذفه فعلياً', async () => {
      prismaMock.appointment.update.mockResolvedValue({ id: 'apt-1', status: 'CANCELLED' } as any);
      const req = mockRequest({ params: { id: 'apt-1' } });
      const res = mockResponse();

      await deleteAppointment(req, res);

      expect(prismaMock.appointment.update).toHaveBeenCalledWith({
        where: { id: 'apt-1' },
        data: { status: 'CANCELLED' },
      });
      expect(mockRoomEmit).toHaveBeenCalledWith('clinical-staff', 'appointment-cancelled', { id: 'apt-1' });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
