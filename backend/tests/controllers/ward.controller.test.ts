import { prismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse } from '../mocks/http';
import { Prisma } from '@prisma/client';
import { getAllWards, createWard, updateWard, deleteWard } from '../../src/controllers/ward.controller';

describe('ward.controller', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('getAllWards', () => {
    it('يرجع كل الأقسام مرتبة بالاسم', async () => {
      const wards = [{ id: 'w1', name: 'ICU' }, { id: 'w2', name: 'ER' }];
      prismaMock.ward.findMany.mockResolvedValue(wards as any);

      const req = mockRequest();
      const res = mockResponse();

      await getAllWards(req, res);

      expect(prismaMock.ward.findMany).toHaveBeenCalledWith({ where: { hospitalId: 'hosp-1' }, include: { _count: { select: { beds: true } } }, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: wards });
    });

    it('يرجع 500 عند حدوث خطأ', async () => {
      prismaMock.ward.findMany.mockRejectedValue(new Error('boom'));
      const req = mockRequest();
      const res = mockResponse();

      await getAllWards(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('createWard', () => {
    it('creates in the caller\'s hospital (201); hospitalId from the body is ignored', async () => {
      prismaMock.ward.findFirst.mockResolvedValue(null);
      prismaMock.ward.create.mockResolvedValue({ id: 'w1', name: 'ICU' } as any);
      const res = mockResponse();
      await createWard(mockRequest({ body: { name: 'ICU', floor: 2, hospitalId: 'evil' } }), res);
      expect(prismaMock.ward.create).toHaveBeenCalledWith(expect.objectContaining({ data: { name: 'ICU', floor: 2, hospitalId: 'hosp-1' } }));
      expect(res.status).toHaveBeenCalledWith(201);
    });
    it('409 on a duplicate name (case-insensitive, same hospital)', async () => {
      prismaMock.ward.findFirst.mockResolvedValue({ id: 'w9' } as any);
      const res = mockResponse();
      await createWard(mockRequest({ body: { name: 'icu' } }), res);
      expect(prismaMock.ward.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { hospitalId: 'hosp-1', name: { equals: 'icu', mode: 'insensitive' } } }));
      expect(res.status).toHaveBeenCalledWith(409);
      expect(prismaMock.ward.create).not.toHaveBeenCalled();
    });
    it('500 on a database error', async () => {
      prismaMock.ward.findFirst.mockRejectedValue(new Error('boom'));
      const res = mockResponse();
      await createWard(mockRequest({ body: { name: 'ICU' } }), res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateWard', () => {
    it('404 for a ward of another hospital', async () => {
      prismaMock.ward.findFirst.mockResolvedValue(null);
      const res = mockResponse();
      await updateWard(mockRequest({ params: { id: 'w1' }, body: { name: 'X' } }), res);
      expect(prismaMock.ward.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'w1', hospitalId: 'hosp-1' } }));
      expect(res.status).toHaveBeenCalledWith(404);
      expect(prismaMock.ward.update).not.toHaveBeenCalled();
    });
    it('409 when renaming onto another ward\'s name', async () => {
      prismaMock.ward.findFirst.mockResolvedValueOnce({ id: 'w1' } as any).mockResolvedValueOnce({ id: 'w2' } as any);
      const res = mockResponse();
      await updateWard(mockRequest({ params: { id: 'w1' }, body: { name: 'ER' } }), res);
      expect(res.status).toHaveBeenCalledWith(409);
    });
    it('updates name and clears the floor with null', async () => {
      prismaMock.ward.findFirst.mockResolvedValueOnce({ id: 'w1' } as any).mockResolvedValueOnce(null);
      prismaMock.ward.update.mockResolvedValue({ id: 'w1' } as any);
      const res = mockResponse();
      await updateWard(mockRequest({ params: { id: 'w1' }, body: { name: 'ER', floor: null } }), res);
      expect(prismaMock.ward.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'w1' }, data: { name: 'ER', floor: null } }));
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('deleteWard', () => {
    it('404 when missing / other hospital', async () => {
      prismaMock.ward.findFirst.mockResolvedValue(null);
      const res = mockResponse();
      await deleteWard(mockRequest({ params: { id: 'w1' } }), res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
    it('409 WARD_HAS_BEDS while the ward has beds', async () => {
      prismaMock.ward.findFirst.mockResolvedValue({ id: 'w1', _count: { beds: 3 } } as any);
      const res = mockResponse();
      await deleteWard(mockRequest({ params: { id: 'w1' } }), res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect((res.json as jest.Mock).mock.calls[0][0].error.code).toBe('WARD_HAS_BEDS');
      expect(prismaMock.ward.delete).not.toHaveBeenCalled();
    });
    it('409 when a bed appears between the check and the delete (FK P2003)', async () => {
      prismaMock.ward.findFirst.mockResolvedValue({ id: 'w1', _count: { beds: 0 } } as any);
      prismaMock.ward.delete.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'x' }));
      const res = mockResponse();
      await deleteWard(mockRequest({ params: { id: 'w1' } }), res);
      expect(res.status).toHaveBeenCalledWith(409);
    });
    it('deletes an empty ward', async () => {
      prismaMock.ward.findFirst.mockResolvedValue({ id: 'w1', _count: { beds: 0 } } as any);
      prismaMock.ward.delete.mockResolvedValue({} as any);
      const res = mockResponse();
      await deleteWard(mockRequest({ params: { id: 'w1' } }), res);
      expect(prismaMock.ward.delete).toHaveBeenCalledWith({ where: { id: 'w1' } });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
