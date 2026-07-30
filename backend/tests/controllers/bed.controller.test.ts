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
      prismaMock.bed.findUnique.mockResolvedValue(null);
      const req = mockRequest({ params: { id: 'nope' } });
      const res = mockResponse();

      await getBedById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('يرجع السرير لو موجود', async () => {
      prismaMock.bed.findUnique.mockResolvedValue({ id: 'b1' } as any);
      const req = mockRequest({ params: { id: 'b1' } });
      const res = mockResponse();

      await getBedById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 'b1' } });
    });
  });

  describe('createBed', () => {
    it('يرفض إذا كانت الحقول المطلوبة ناقصة', async () => {
      const req = mockRequest({ body: { bedNumber: 'A1' } }); // wardId, hospitalId ناقصين
      const res = mockResponse();

      await createBed(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(prismaMock.bed.create).not.toHaveBeenCalled();
    });

    it('ينشئ سرير جديد بحالة AVAILABLE افتراضياً', async () => {
      const req = mockRequest({
        body: { bedNumber: 'A1', wardId: 'ward-1', hospitalId: 'hosp-1' },
      });
      const res = mockResponse();

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
        body: { bedNumber: 'A2', wardId: 'ward-1', hospitalId: 'hosp-1', status: 'MAINTENANCE' },
      });
      const res = mockResponse();
      prismaMock.bed.create.mockResolvedValue({ id: 'new-bed-2' } as any);

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
      prismaMock.bed.delete.mockResolvedValue({} as any);

      await deleteBed(req, res);

      expect(prismaMock.bed.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('يرجع 500 لو فشل الحذف (متل foreign key constraint)', async () => {
      const req = mockRequest({ params: { id: 'b1' } });
      const res = mockResponse();
      prismaMock.bed.delete.mockRejectedValue(new Error('FK constraint'));

      await deleteBed(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
