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

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, count: 1 })
      );
    });
  });

  describe('getStaffById', () => {
    it('يرجع 404 لو الموظف مش موجود', async () => {
      (prismaMock as any).staff.findUnique.mockResolvedValue(null);
      const req = mockRequest({ params: { id: 'nope' } });
      const res = mockResponse();

      await getStaffById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('createStaff', () => {
    it('ينشئ موظف جديد', async () => {
      (prismaMock as any).staff.create.mockResolvedValue({ id: 's-new' });
      const req = mockRequest({
        body: { name: 'Nour', email: 'nour@hospilink.com', role: 'NURSE', department: 'ER' },
      });
      const res = mockResponse();

      await createStaff(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('updateStaff', () => {
    it('يحدث بيانات الموظف', async () => {
      (prismaMock as any).staff.update.mockResolvedValue({ id: 's1', name: 'Updated' });
      const req = mockRequest({ params: { id: 's1' }, body: { name: 'Updated' } });
      const res = mockResponse();

      await updateStaff(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('deleteStaff', () => {
    it('يحذف الموظف', async () => {
      (prismaMock as any).staff.delete.mockResolvedValue({});
      const req = mockRequest({ params: { id: 's1' } });
      const res = mockResponse();

      await deleteStaff(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getShifts', () => {
    it('يبني نطاق startTime/endTime صح لما يتم تمرير date', async () => {
      (prismaMock as any).shift.findMany.mockResolvedValue([]);
      const req = mockRequest({ query: { date: '2026-08-01' } });
      const res = mockResponse();

      await getShifts(req, res);

      const whereArg = (prismaMock as any).shift.findMany.mock.calls[0][0].where;
      expect(whereArg.startTime.gte).toBeInstanceOf(Date);
      expect(whereArg.endTime.lte).toBeInstanceOf(Date);
    });
  });

  describe('createShift', () => {
    it('ينشئ شفت جديد ويبث shift-update لغرفة القسم', async () => {
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
        'department-ER',
        'shift-update',
        expect.objectContaining({ id: 'shift-1' })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('updateShift', () => {
    it('يحدث الشفت ويبث التحديث لغرفة القسم الراجع من الداتابيز', async () => {
      (prismaMock as any).shift.update.mockResolvedValue({ id: 'shift-1', department: 'ICU' });

      const req = mockRequest({
        params: { id: 'shift-1' },
        body: { type: 'NIGHT' },
      });
      const res = mockResponse();

      await updateShift(req, res);

      expect(mockRoomEmit).toHaveBeenCalledWith(
        'department-ICU',
        'shift-update',
        expect.objectContaining({ id: 'shift-1' })
      );
    });
  });

  describe('deleteShift', () => {
    it('يحذف الشفت ويبث shift-delete', async () => {
      (prismaMock as any).shift.delete.mockResolvedValue({ id: 'shift-1', department: 'ER' });

      const req = mockRequest({ params: { id: 'shift-1' } });
      const res = mockResponse();

      await deleteShift(req, res);

      expect(mockRoomEmit).toHaveBeenCalledWith('department-ER', 'shift-delete', { id: 'shift-1' });
      expect(res.status).toHaveBeenCalledWith(200);
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

      const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(Object.keys(jsonArg.data)).toEqual(expect.arrayContaining(['ER', 'ICU']));
      expect(jsonArg.data.ER[0].staffName).toBe('Nour');
    });
  });
});
