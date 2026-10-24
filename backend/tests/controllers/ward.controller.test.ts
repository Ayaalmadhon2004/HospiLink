import { prismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse } from '../mocks/http';
import { getAllWards } from '../../src/controllers/ward.controller';

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
});
