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
      prismaMock.bed.count.mockResolvedValue(2);

      const req = mockRequest();
      const res = mockResponse();

      await getAllBeds(req, res);

      expect(prismaMock.bed.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { hospitalId: 'hosp-1' }, skip: 0, take: 100 }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: beds,
        pagination: { page: 1, limit: 100, totalCount: 2, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      });
    });

    it('يطبّق page و limit ويحدّ الـ limit بـ 200', async () => {
      prismaMock.bed.findMany.mockResolvedValue([] as any);
      prismaMock.bed.count.mockResolvedValue(450);
      const res = mockResponse();

      await getAllBeds(mockRequest({ query: { page: '3', limit: '500' } }), res);

      expect(prismaMock.bed.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 400, take: 200 }));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        pagination: { page: 3, limit: 200, totalCount: 450, totalPages: 3, hasNextPage: false, hasPrevPage: true },
      }));
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
    const asTx = () => (prismaMock.$transaction as unknown as jest.Mock).mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock));
    const bedRow = (patient: { id: string } | null = null) => ({ id: 'b1', patient });
    const call = async (body: object, bed = bedRow()) => {
      asTx();
      prismaMock.bed.findFirst.mockResolvedValue(bed as any);
      prismaMock.bed.update.mockResolvedValue({ id: 'b1' } as any);
      prismaMock.bed.updateMany.mockResolvedValue({ count: 1 } as any);
      prismaMock.patient.update.mockResolvedValue({} as any);
      const res = mockResponse();
      await updateBedStatus(mockRequest({ params: { id: 'b1' }, body }), res);
      return res;
    };

    it('patientId null: the patient leaves and the bed becomes AVAILABLE', async () => {
      const res = await call({ patientId: null }, bedRow({ id: 'p1' }));

      expect(prismaMock.patient.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { bedId: null } });
      expect((prismaMock.bed.update.mock.calls[0][0] as any).data.status).toBe('AVAILABLE');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('unassigning with another status keeps that status (e.g. CLEANING after the patient left)', async () => {
      await call({ patientId: '', status: 'CLEANING' }, bedRow({ id: 'p1' }));
      expect((prismaMock.bed.update.mock.calls[0][0] as any).data.status).toBe('CLEANING');
    });

    it('assigning a patient claims the bed, frees the patient\'s previous bed and links both sides', async () => {
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1', bedId: 'bed-old', status: 'OBSERVATION' } as any);
      const res = await call({ patientId: 'p1' });

      expect(prismaMock.bed.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: 'b1', hospitalId: 'hosp-1', status: 'AVAILABLE', patient: { is: null } },
        data: { status: 'OCCUPIED' },
      });
      expect(prismaMock.bed.updateMany).toHaveBeenNthCalledWith(2, { where: { id: 'bed-old', hospitalId: 'hosp-1' }, data: { status: 'AVAILABLE' } });
      expect(prismaMock.patient.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { bedId: 'b1' } });
      expect((prismaMock.bed.update.mock.calls[0][0] as any).data.status).toBe('OCCUPIED');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('assigning the patient who is already in the bed changes no patient and keeps OCCUPIED', async () => {
      await call({ patientId: 'p1' }, bedRow({ id: 'p1' }));
      expect(prismaMock.patient.update).not.toHaveBeenCalled();
      expect((prismaMock.bed.update.mock.calls[0][0] as any).data.status).toBe('OCCUPIED');
    });

    it('409 when the bed already has another patient, 409 when it is not AVAILABLE, 400 for a discharged patient', async () => {
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p2', bedId: null, status: 'OBSERVATION' } as any);
      const taken = await call({ patientId: 'p2' }, bedRow({ id: 'p1' }));
      expect(taken.status).toHaveBeenCalledWith(409);

      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p2', bedId: null, status: 'OBSERVATION' } as any);
      asTx();
      prismaMock.bed.findFirst.mockResolvedValue(bedRow() as any);
      prismaMock.bed.updateMany.mockResolvedValue({ count: 0 } as any); // CLEANING / MAINTENANCE bed
      const res2 = mockResponse();
      await updateBedStatus(mockRequest({ params: { id: 'b1' }, body: { patientId: 'p2' } }), res2);
      expect(res2.status).toHaveBeenCalledWith(409);

      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p3', bedId: null, status: 'DISCHARGED' } as any);
      const res3 = await call({ patientId: 'p3' });
      expect(res3.status).toHaveBeenCalledWith(400);
      expect(prismaMock.patient.update).not.toHaveBeenCalled();
    });

    it('400 for contradictory input: a patient with a non-OCCUPIED status, or OCCUPIED without a patient', async () => {
      const a = await call({ patientId: 'p1', status: 'AVAILABLE' });
      expect(a.status).toHaveBeenCalledWith(400);
      const b = await call({ patientId: null, status: 'OCCUPIED' }, bedRow({ id: 'p1' }));
      expect(b.status).toHaveBeenCalledWith(400);
      const c = await call({ status: 'OCCUPIED' }); // bed has no patient
      expect(c.status).toHaveBeenCalledWith(400);
      expect(prismaMock.bed.update).not.toHaveBeenCalled();
    });

    it('409 when a bed that has a patient is switched to AVAILABLE/CLEANING/MAINTENANCE by status alone', async () => {
      for (const status of ['AVAILABLE', 'CLEANING', 'MAINTENANCE']) {
        const res = await call({ status }, bedRow({ id: 'p1' }));
        expect(res.status).toHaveBeenCalledWith(409);
      }
      expect(prismaMock.bed.update).not.toHaveBeenCalled();
    });

    it('status only on a bed without a patient, and OCCUPIED on a bed that has one, are fine', async () => {
      const ok = await call({ status: 'CLEANING' });
      expect(ok.status).toHaveBeenCalledWith(200);
      expect((prismaMock.bed.update.mock.calls[0][0] as any).data).toEqual({ status: 'CLEANING' });

      const same = await call({ status: 'OCCUPIED' }, bedRow({ id: 'p1' }));
      expect(same.status).toHaveBeenCalledWith(200);
    });

    it('a duplicate bed number in the ward answers 409', async () => {
      asTx();
      prismaMock.bed.findFirst.mockResolvedValue(bedRow() as any);
      prismaMock.bed.update.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
      const res = mockResponse();
      await updateBedStatus(mockRequest({ params: { id: 'b1' }, body: { bedNumber: 'A2' } }), res);
      expect(res.status).toHaveBeenCalledWith(409);
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

    it('409 لو السرير فيه مريض، وما بيحذف', async () => {
      prismaMock.bed.findFirst.mockResolvedValue({ id: 'b1', patient: { id: 'p1' } } as any);
      const res = mockResponse();

      await deleteBed(mockRequest({ params: { id: 'b1' } }), res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(prismaMock.bed.delete).not.toHaveBeenCalled();
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
      (prismaMock.$transaction as unknown as jest.Mock).mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock));
      const res = mockResponse();
      prismaMock.bed.findFirst.mockResolvedValue({ id: 'b1', patient: null } as any);
      prismaMock.patient.findFirst.mockResolvedValue(null);

      await updateBedStatus(mockRequest({ params: { id: 'b1' }, body: { patientId: 'foreign-patient' } }), res);

      expect(prismaMock.patient.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign-patient', hospitalId: 'hosp-1' } }));
      expect(res.status).toHaveBeenCalledWith(404);
      expect(prismaMock.bed.update).not.toHaveBeenCalled();
    });

    it('createBed refuses status OCCUPIED (a new bed has no patient) and answers 409 for a duplicate number', async () => {
      const res = mockResponse();
      await createBed(mockRequest({ body: { bedNumber: 'A1', wardId: 'ward-1', status: 'OCCUPIED' } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prismaMock.bed.create).not.toHaveBeenCalled();

      prismaMock.ward.findFirst.mockResolvedValue({ id: 'ward-1' } as any);
      prismaMock.bed.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
      const res2 = mockResponse();
      await createBed(mockRequest({ body: { bedNumber: 'A1', wardId: 'ward-1' } }), res2);
      expect(res2.status).toHaveBeenCalledWith(409);
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
