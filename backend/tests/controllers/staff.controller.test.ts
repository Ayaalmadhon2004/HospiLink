import { prismaMock } from '../mocks/prisma';
import { mockRoomEmit } from '../mocks/io';
import { mockRequest, mockResponse } from '../mocks/http';
import {
  getStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  getShifts,
  createShift,
  updateShift,
  deleteShift,
  getShiftTimeline,
} from '../../src/controllers/staff.controller';

describe('staff.controller', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  describe('getStaff', () => {
    it('يرجع كل الطاقم الطبي', async () => {
      (prismaMock as any).staff.findMany.mockResolvedValue([{ id: 's1' }]);
      const req = mockRequest();
      const res = mockResponse();

      await getStaff(req, res);

      expect((prismaMock as any).staff.findMany).toHaveBeenCalledWith({ where: { hospitalId: 'hosp-1' } });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, count: 1 })
      );
    });
  });

  describe('getStaffById', () => {
    it('يرجع 404 لو الموظف مش موجود', async () => {
      (prismaMock as any).staff.findFirst.mockResolvedValue(null);
      const req = mockRequest({ params: { id: 'nope' } });
      const res = mockResponse();

      await getStaffById(req, res);

      expect((prismaMock as any).staff.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'nope', hospitalId: 'hosp-1' } })
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('createStaff', () => {
    it('ينشئ موظف جديد', async () => {
      (prismaMock as any).staff.create.mockResolvedValue({ id: 's-new' });
      const req = mockRequest({
        body: { name: 'Nour', email: 'nour@hospilink.com', role: 'NURSE', department: 'ER', hospitalId: 'other-hospital' },
      });
      const res = mockResponse();

      await createStaff(req, res);

      // hospitalId comes from the caller, never from the body
      expect((prismaMock as any).staff.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Nour', hospitalId: 'hosp-1' }),
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('updateStaff', () => {
    it('يحدث بيانات الموظف', async () => {
      (prismaMock as any).staff.findFirst.mockResolvedValue({ id: 's1' });
      (prismaMock as any).staff.update.mockResolvedValue({ id: 's1', name: 'Updated' });
      const req = mockRequest({ params: { id: 's1' }, body: { name: 'Updated' } });
      const res = mockResponse();

      await updateStaff(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('يرجع 404 لموظف من مستشفى ثاني', async () => {
      (prismaMock as any).staff.findFirst.mockResolvedValue(null);
      const res = mockResponse();

      await updateStaff(mockRequest({ params: { id: 'foreign' }, body: { name: 'x' } }), res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect((prismaMock as any).staff.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteStaff', () => {
    it('يحذف الموظف', async () => {
      (prismaMock as any).staff.findFirst.mockResolvedValue({ id: 's1' });
      (prismaMock as any).staff.delete.mockResolvedValue({});
      const req = mockRequest({ params: { id: 's1' } });
      const res = mockResponse();

      await deleteStaff(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('يرجع 404 لموظف من مستشفى ثاني ولا يحذف', async () => {
      (prismaMock as any).staff.findFirst.mockResolvedValue(null);
      const res = mockResponse();

      await deleteStaff(mockRequest({ params: { id: 'foreign' } }), res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect((prismaMock as any).staff.delete).not.toHaveBeenCalled();
    });
  });

  describe('getShifts', () => {
    it('يبني نطاق startTime/endTime صح لما يتم تمرير date', async () => {
      (prismaMock as any).shift.findMany.mockResolvedValue([]);
      const req = mockRequest({ query: { date: '2026-08-01' } });
      const res = mockResponse();

      await getShifts(req, res);

      const whereArg = (prismaMock as any).shift.findMany.mock.calls[0][0].where;
      expect(whereArg.staff).toEqual({ hospitalId: 'hosp-1' });
      expect(whereArg.startTime.gte).toBeInstanceOf(Date);
      expect(whereArg.endTime.lte).toBeInstanceOf(Date);
    });
  });

  describe('createShift', () => {
    it('يرجع 404 لو الموظف من مستشفى ثاني', async () => {
      (prismaMock as any).staff.findFirst.mockResolvedValue(null);
      const res = mockResponse();

      await createShift(mockRequest({ body: { staffId: 'foreign', type: 'DAY', startTime: 'a', endTime: 'b', department: 'ER' } }), res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect((prismaMock as any).shift.create).not.toHaveBeenCalled();
    });

    it('ينشئ شفت جديد ويبث shift-update لغرفة القسم', async () => {
      (prismaMock as any).staff.findFirst.mockResolvedValue({ id: 's1' });
      (prismaMock as any).shift.create.mockResolvedValue({
        id: 'shift-1',
        department: 'ER',
      });

      const req = mockRequest({
        body: {
          staffId: 's1',
          type: 'DAY',
          startTime: '2026-08-01T08:00:00Z',
          endTime: '2026-08-01T16:00:00Z',
          department: 'ER',
        },
      });
      const res = mockResponse();

      await createShift(req, res);

      expect(mockRoomEmit).toHaveBeenCalledWith(
        'h-hosp-1:department-ER',
        'shift-update',
        expect.objectContaining({ id: 'shift-1' })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('updateShift', () => {
    it('يحدث الشفت ويبث التحديث لغرفة القسم الراجع من الداتابيز', async () => {
      (prismaMock as any).shift.findFirst.mockResolvedValue({ id: 'shift-1' });
      (prismaMock as any).shift.update.mockResolvedValue({ id: 'shift-1', department: 'ICU' });

      const req = mockRequest({
        params: { id: 'shift-1' },
        body: { type: 'NIGHT' },
      });
      const res = mockResponse();

      await updateShift(req, res);

      expect(mockRoomEmit).toHaveBeenCalledWith(
        'h-hosp-1:department-ICU',
        'shift-update',
        expect.objectContaining({ id: 'shift-1' })
      );
    });
  });

  describe('deleteShift', () => {
    it('يحذف الشفت ويبث shift-delete', async () => {
      (prismaMock as any).shift.findFirst.mockResolvedValue({ id: 'shift-1' });
      (prismaMock as any).shift.delete.mockResolvedValue({ id: 'shift-1', department: 'ER' });

      const req = mockRequest({ params: { id: 'shift-1' } });
      const res = mockResponse();

      await deleteShift(req, res);

      expect(mockRoomEmit).toHaveBeenCalledWith('h-hosp-1:department-ER', 'shift-delete', { id: 'shift-1' });
      expect((prismaMock as any).shift.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'shift-1', staff: { hospitalId: 'hosp-1' } } })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('shifts of another hospital', () => {
    it('updateShift / deleteShift return 404 and touch nothing', async () => {
      (prismaMock as any).shift.findFirst.mockResolvedValue(null);

      const res1 = mockResponse();
      await updateShift(mockRequest({ params: { id: 'foreign' }, body: { type: 'NIGHT' } }), res1);
      expect(res1.status).toHaveBeenCalledWith(404);

      const res2 = mockResponse();
      await deleteShift(mockRequest({ params: { id: 'foreign' } }), res2);
      expect(res2.status).toHaveBeenCalledWith(404);

      expect((prismaMock as any).shift.update).not.toHaveBeenCalled();
      expect((prismaMock as any).shift.delete).not.toHaveBeenCalled();
    });
  });

  describe('getShiftTimeline', () => {
    it('يجمع الشفتات حسب القسم', async () => {
      (prismaMock as any).shift.findMany.mockResolvedValue([
        {
          id: 'sh1',
          department: 'ER',
          staff: { name: 'Nour', role: 'NURSE', avatar: null },
          type: 'DAY',
          startTime: new Date(),
          endTime: new Date(),
          notes: null,
        },
        {
          id: 'sh2',
          department: 'ICU',
          staff: { name: 'Sara', role: 'DOCTOR', avatar: null },
          type: 'NIGHT',
          startTime: new Date(),
          endTime: new Date(),
          notes: null,
        },
      ]);

      const req = mockRequest({ query: {} });
      const res = mockResponse();

      await getShiftTimeline(req, res);

      expect((prismaMock as any).shift.findMany.mock.calls[0][0].where.staff).toEqual({ hospitalId: 'hosp-1' });
      const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(Object.keys(jsonArg.data)).toEqual(expect.arrayContaining(['ER', 'ICU']));
      expect(jsonArg.data.ER[0].staffName).toBe('Nour');
    });
  });
});
