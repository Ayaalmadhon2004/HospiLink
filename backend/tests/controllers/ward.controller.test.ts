import { prismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse } from '../mocks/http';
import { getAllWards, getWardById } from '../../src/controllers/ward.controller';

describe('ward.controller', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('getAllWards', () => {
    it('يرجع كل الأقسام مرتبة بالاسم', async () => {
      const wards = [{ id: 'w1', name: 'ICU' }, { id: 'w2', name: 'ER' }];
      prismaMock.ward.findMany.mockResolvedValue(wards as any);

      const req = mockRequest();
      const res = mockResponse();

      await getAllWards(req, res);

      expect(prismaMock.ward.findMany).toHaveBeenCalledWith({ where: { hospitalId: 'hosp-1' }, orderBy: { name: 'asc' } });
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

  describe('getWardById', () => {
    it('يرجع 404 لو القسم مش موجود', async () => {
      prismaMock.ward.findFirst.mockResolvedValue(null);
      const req = mockRequest({ params: { id: 'nope' } });
      const res = mockResponse();

      await getWardById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Ward not found' });
    });

    it('يرجع القسم مع أسرته لو موجود', async () => {
      const ward = { id: 'w1', name: 'ICU', beds: [{ id: 'b1', patient: null }] };
      prismaMock.ward.findFirst.mockResolvedValue(ward as any);
      const req = mockRequest({ params: { id: 'w1' } });
      const res = mockResponse();

      await getWardById(req, res);

      expect(prismaMock.ward.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'w1', hospitalId: 'hosp-1' } }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: ward });
    });
  });
});
