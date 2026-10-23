import { prismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse } from '../mocks/http';
import {
  getAllBeds,
  getBedById,
  createBed,
  updateBedStatus,
  deleteBed,
} from '../../src/controllers/bed.controller';

describe('bed.controller', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  describe('getAllBeds', () => {
    it('يرجع كل الأسرة مع الـ ward و patient', async () => {
      const beds = [{ id: 'b1' }, { id: 'b2' }];
      prismaMock.bed.findMany.mockResolvedValue(beds as any);

      const req = mockRequest();
      const res = mockResponse();

      await getAllBeds(req, res);

      expect(prismaMock.bed.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { hospitalId: 'hosp-1' } }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: beds });
    });

    it('يرجع 500 لو صار خطأ بالداتابيز', async () => {
      prismaMock.bed.findMany.mockRejectedValue(new Error('DB error'));
      const req = mockRequest();
      const res = mockResponse();

      await getAllBeds(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getBedById', () => {
    it('يرجع 404 لو السرير مش موجود', async () => {
      prismaMock.bed.findFirst.mockResolvedValue(null);
      const req = mockRequest({ params: { id: 'nope' } });
      const res = mockResponse();

      await getBedById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('يرجع السرير لو موجود', async () => {
      prismaMock.bed.findFirst.mockResolvedValue({ id: 'b1' } as any);
      const req = mockRequest({ params: { id: 'b1' } });
      const res = mockResponse();

      await getBedById(req, res);

      expect(prismaMock.bed.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'b1', hospitalId: 'hosp-1' } }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 'b1' } });
    });
  });

  describe('createBed', () => {
    it('يرفض إذا كانت الحقول المطلوبة ناقصة', async () => {
      const req = mockRequest({ body: { bedNumber: 'A1' } }); // wardId ناقص
      const res = mockResponse();

      await createBed(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(prismaMock.bed.create).not.toHaveBeenCalled();
    });

    it('ينشئ سرير جديد بحالة AVAILABLE افتراضياً', async () => {
      const req = mockRequest({
        body: { bedNumber: 'A1', wardId: 'ward-1' },
      });
      const res = mockResponse();

      prismaMock.ward.findFirst.mockResolvedValue({ id: 'ward-1' } as any);
      prismaMock.bed.create.mockResolvedValue({ id: 'new-bed' } as any);

      await createBed(req, res);

      expect(prismaMock.bed.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ bedNumber: 'A1', status: 'AVAILABLE' }),
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('يستخدم الحالة المرسلة بدل الافتراضية لو تم تحديدها', async () => {
      const req = mockRequest({
        body: { bedNumber: 'A2', wardId: 'ward-1', status: 'MAINTENANCE' },
      });
      const res = mockResponse();
      prismaMock.ward.findFirst.mockResolvedValue({ id: 'ward-1' } as any);      prismaMock.bed.create.mockResolvedValue({ id: 'new-bed-2' } as any);

      await createBed(req, res);

      expect(prismaMock.bed.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'MAINTENANCE' }) })
      );
    });
  });

  describe('updateBedStatus', () => {
    it('يفصل المريض عن السرير لو patientId جاي null', async () => {
      const req = mockRequest({ params: { id: 'b1' }, body: { patientId: null } });
      const res = mockResponse();
      prismaMock.bed.findFirst.mockResolvedValue({ id: 'b1' } as any);
      prismaMock.bed.update.mockResolvedValue({ id: 'b1' } as any);

      await updateBedStatus(req, res);

      expect(prismaMock.bed.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ patient: { disconnect: true } }),
        })
      );
    });

    it('يربط مريض جديد بالسرير لو تم تمرير patientId', async () => {
      const req = mockRequest({ params: { id: 'b1' }, body: { patientId: 'p1' } });
      const res = mockResponse();
      prismaMock.bed.findFirst.mockResolvedValue({ id: 'b1' } as any);
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1' } as any);
      prismaMock.bed.update.mockResolvedValue({ id: 'b1' } as any);

      await updateBedStatus(req, res);

      expect(prismaMock.bed.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ patient: { connect: { id: 'p1' } } }),
        })
      );
    });

    it('يحدث فقط الحقول المرسلة (partial update)', async () => {
      const req = mockRequest({ params: { id: 'b1' }, body: { status: 'CLEANING' } });
      const res = mockResponse();
      prismaMock.bed.findFirst.mockResolvedValue({ id: 'b1' } as any);
      prismaMock.bed.update.mockResolvedValue({ id: 'b1' } as any);

      await updateBedStatus(req, res);

      const dataArg = (prismaMock.bed.update.mock.calls[0][0] as any).data;
      expect(dataArg).toEqual({ status: 'CLEANING' });
    });
  });

  describe('deleteBed', () => {
    it('يحذف السرير ويرجع رسالة نجاح', async () => {
      const req = mockRequest({ params: { id: 'b1' } });
      const res = mockResponse();
      prismaMock.bed.findFirst.mockResolvedValue({ id: 'b1' } as any);
      prismaMock.bed.delete.mockResolvedValue({} as any);

      await deleteBed(req, res);

      expect(prismaMock.bed.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('يرجع 500 لو فشل الحذف (متل foreign key constraint)', async () => {
      const req = mockRequest({ params: { id: 'b1' } });
      const res = mockResponse();
      prismaMock.bed.findFirst.mockResolvedValue({ id: 'b1' } as any);
      prismaMock.bed.delete.mockRejectedValue(new Error('FK constraint'));

      await deleteBed(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('multi-tenancy', () => {
    it('createBed ignores hospitalId from the body and uses the caller hospital', async () => {
      const req = mockRequest({ body: { bedNumber: 'A1', wardId: 'ward-1', hospitalId: 'other-hospital' } });
      const res = mockResponse();
      prismaMock.ward.findFirst.mockResolvedValue({ id: 'ward-1' } as any);
      prismaMock.bed.create.mockResolvedValue({ id: 'b' } as any);

      await createBed(req, res);

      expect(prismaMock.ward.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'ward-1', hospitalId: 'hosp-1' } }));
      const data = (prismaMock.bed.create.mock.calls[0][0] as any).data;
      expect(data.hospital).toEqual({ connect: { id: 'hosp-1' } });
    });

    it('createBed returns 404 for a ward of another hospital', async () => {
      const req = mockRequest({ body: { bedNumber: 'A1', wardId: 'foreign-ward' } });
      const res = mockResponse();
      prismaMock.ward.findFirst.mockResolvedValue(null);

      await createBed(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prismaMock.bed.create).not.toHaveBeenCalled();
    });

    it('updateBedStatus never writes hospital and 404s for a foreign bed', async () => {
      const res = mockResponse();
      prismaMock.bed.findFirst.mockResolvedValue(null);

      await updateBedStatus(mockRequest({ params: { id: 'foreign' }, body: { status: 'CLEANING', hospitalId: 'x' } }), res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prismaMock.bed.update).not.toHaveBeenCalled();
    });

    it('updateBedStatus rejects a patient from another hospital', async () => {
      const res = mockResponse();
      prismaMock.bed.findFirst.mockResolvedValue({ id: 'b1' } as any);
      prismaMock.patient.findFirst.mockResolvedValue(null);

      await updateBedStatus(mockRequest({ params: { id: 'b1' }, body: { patientId: 'foreign-patient' } }), res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prismaMock.bed.update).not.toHaveBeenCalled();
    });

    it('deleteBed returns 404 for a bed of another hospital', async () => {
      const res = mockResponse();
      prismaMock.bed.findFirst.mockResolvedValue(null);

      await deleteBed(mockRequest({ params: { id: 'foreign' } }), res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prismaMock.bed.delete).not.toHaveBeenCalled();
    });
  });
});
