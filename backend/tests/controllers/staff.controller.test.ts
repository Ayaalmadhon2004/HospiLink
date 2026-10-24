import { prismaMock } from '../mocks/prisma';
import { mockRoomEmit } from '../mocks/io';
import { mockRequest, mockResponse } from '../mocks/http';

jest.mock('../../src/services/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue(undefined),
  appLink: (path: string, token: string) => `https://app.test${path}#token=${token}`,
}));
jest.mock('../../src/services/authTokens', () => ({
  issueAuthToken: jest.fn().mockResolvedValue('setup-token-0123456789abcdef'),
  consumeAuthToken: jest.fn(),
}));
import { sendMail } from '../../src/services/mailer';
import { issueAuthToken } from '../../src/services/authTokens';
import {
  getStaff,
  getStaffById,
  createStaff,
  updateStaff,
  setStaffLogin,
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
      (prismaMock as any).staff.count.mockResolvedValue(1);
      const req = mockRequest();
      const res = mockResponse();

      await getStaff(req, res);

      expect((prismaMock as any).staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { hospitalId: 'hosp-1' }, skip: 0, take: 100 })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, count: 1, pagination: expect.objectContaining({ page: 1, totalCount: 1 }) })
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
    const flush = () => new Promise((r) => setImmediate(r));
    const body = { name: 'Nour', email: 'nour@hospilink.com', role: 'Nurse', department: 'ER' };
    beforeEach(() => {
      (prismaMock as any).$transaction.mockImplementation(async (cb: any) => cb(prismaMock));
      (sendMail as jest.Mock).mockClear();
      (issueAuthToken as jest.Mock).mockClear();
      (prismaMock as any).user.findUnique.mockResolvedValue(null);
      (prismaMock as any).staff.create.mockImplementation(async ({ data }: any) => ({ id: 's-new', ...data }));
    });

    it('ينشئ موظف جديد بدون حساب دخول، و hospitalId من المستخدم مش من الـ body', async () => {
      const res = mockResponse();

      await createStaff(mockRequest({ body: { ...body, hospitalId: 'other-hospital' } }), res);

      expect((prismaMock as any).staff.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Nour', hospitalId: 'hosp-1', userId: null }),
      });
      expect((prismaMock as any).user.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      const { data } = (res.json as jest.Mock).mock.calls[0][0];
      expect(data.hasLogin).toBe(false);
      expect(data).not.toHaveProperty('userId');
    });

    it('بيربط تلقائياً حساب موجود غير مربوط من نفس المستشفى', async () => {
      (prismaMock as any).user.findUnique.mockResolvedValue({ id: 'u-1', hospitalId: 'hosp-1', staff: null });
      const res = mockResponse();

      await createStaff(mockRequest({ body }), res);

      expect((prismaMock as any).staff.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'u-1' }) });
      expect((res.json as jest.Mock).mock.calls[0][0].data.hasLogin).toBe(true);
    });

    it('ما بيربط حساب من مستشفى ثاني (حتى لو نفس الإيميل)', async () => {
      (prismaMock as any).user.findUnique.mockResolvedValue({ id: 'u-x', hospitalId: 'other', staff: null });
      const res = mockResponse();

      await createStaff(mockRequest({ body }), res);

      expect((prismaMock as any).staff.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: null }) });
    });

    it('مع loginRole بينشئ حساب ACTIVE ويربطه ويرسل رابط تعيين كلمة المرور', async () => {
      (prismaMock as any).user.create.mockResolvedValue({ id: 'u-new' });
      const res = mockResponse();

      await createStaff(mockRequest({ body: { ...body, loginRole: 'DOCTOR' } }), res);
      await flush();

      const userData = (prismaMock as any).user.create.mock.calls[0][0].data;
      expect(userData).toMatchObject({
        email: 'nour@hospilink.com', role: 'DOCTOR', accountStatus: 'ACTIVE', hospitalId: 'hosp-1', department: 'ER',
      });
      expect(userData.emailVerifiedAt).toBeInstanceOf(Date);
      expect(userData.password).toMatch(/^\$2[aby]\$/); // hashed random password, never plain
      expect((prismaMock as any).staff.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'u-new' }) });
      expect(issueAuthToken).toHaveBeenCalledWith('u-new', 'PASSWORD_RESET', expect.any(Number));
      expect(sendMail).toHaveBeenCalledWith('nour@hospilink.com', expect.any(String), expect.stringContaining('/reset-password#token='));
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('مع loginRole: 409 لو الإيميل لحساب بمستشفى ثاني، ولا ينشئ شي', async () => {
      (prismaMock as any).user.findUnique.mockResolvedValue({ id: 'u-x', hospitalId: 'other', staff: null });
      const res = mockResponse();

      await createStaff(mockRequest({ body: { ...body, loginRole: 'NURSE' } }), res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect((prismaMock as any).staff.create).not.toHaveBeenCalled();
      expect((prismaMock as any).user.create).not.toHaveBeenCalled();
    });

    it('مع loginRole: 409 لو الحساب مربوط أصلاً بموظف ثاني', async () => {
      (prismaMock as any).user.findUnique.mockResolvedValue({ id: 'u-1', hospitalId: 'hosp-1', staff: { id: 's-other' } });
      const res = mockResponse();

      await createStaff(mockRequest({ body: { ...body, loginRole: 'NURSE' } }), res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect((prismaMock as any).staff.create).not.toHaveBeenCalled();
    });

    it('409 لو الإيميل مستخدم لموظف ثاني (unique)', async () => {
      (prismaMock as any).staff.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
      const res = mockResponse();

      await createStaff(mockRequest({ body }), res);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe('setStaffLogin', () => {
    it('404 لموظف من مستشفى ثاني', async () => {
      (prismaMock as any).staff.findFirst.mockResolvedValue(null);
      const res = mockResponse();

      await setStaffLogin(mockRequest({ params: { id: 's1' }, body: { userId: 'u1' } }), res);

      expect((prismaMock as any).staff.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 's1', hospitalId: 'hosp-1' } }));
      expect(res.status).toHaveBeenCalledWith(404);
      expect((prismaMock as any).staff.update).not.toHaveBeenCalled();
    });

    it('404 لحساب من مستشفى ثاني', async () => {
      (prismaMock as any).staff.findFirst.mockResolvedValue({ id: 's1' });
      (prismaMock as any).user.findFirst.mockResolvedValue(null);
      const res = mockResponse();

      await setStaffLogin(mockRequest({ params: { id: 's1' }, body: { userId: 'foreign' } }), res);

      expect((prismaMock as any).user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign', hospitalId: 'hosp-1' } }));
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('409 لو الحساب مربوط بموظف ثاني', async () => {
      (prismaMock as any).staff.findFirst.mockResolvedValue({ id: 's1' });
      (prismaMock as any).user.findFirst.mockResolvedValue({ id: 'u1', staff: { id: 's2' } });
      const res = mockResponse();

      await setStaffLogin(mockRequest({ params: { id: 's1' }, body: { userId: 'u1' } }), res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect((prismaMock as any).staff.update).not.toHaveBeenCalled();
    });

    it('بيربط الحساب، وبيفك الربط بـ null', async () => {
      (prismaMock as any).staff.findFirst.mockResolvedValue({ id: 's1' });
      (prismaMock as any).user.findFirst.mockResolvedValue({ id: 'u1', staff: null });
      (prismaMock as any).staff.update.mockImplementation(async ({ data }: any) => ({ id: 's1', ...data }));

      const res1 = mockResponse();
      await setStaffLogin(mockRequest({ params: { id: 's1' }, body: { userId: 'u1' } }), res1);
      expect((prismaMock as any).staff.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { userId: 'u1' } });
      expect((res1.json as jest.Mock).mock.calls[0][0].data).toMatchObject({ hasLogin: true });

      const res2 = mockResponse();
      await setStaffLogin(mockRequest({ params: { id: 's1' }, body: { userId: null } }), res2);
      expect((prismaMock as any).staff.update).toHaveBeenLastCalledWith({ where: { id: 's1' }, data: { userId: null } });
      expect((res2.json as jest.Mock).mock.calls[0][0].data).toMatchObject({ hasLogin: false });
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

    it('تصحيح إيميل موظف بدون حساب بيربطه بحساب مطابق من نفس المستشفى', async () => {
      (prismaMock as any).staff.findFirst.mockResolvedValue({ id: 's1', userId: null });
      (prismaMock as any).user.findFirst.mockResolvedValue({ id: 'u-fix' });
      (prismaMock as any).staff.update.mockImplementation(async ({ data }: any) => ({ id: 's1', ...data }));
      const res = mockResponse();

      await updateStaff(mockRequest({ params: { id: 's1' }, body: { email: 'right@h.com' } }), res);

      expect((prismaMock as any).user.findFirst).toHaveBeenCalledWith({
        where: { hospitalId: 'hosp-1', email: { equals: 'right@h.com', mode: 'insensitive' }, staff: null },
        select: { id: true },
      });
      expect((prismaMock as any).staff.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { email: 'right@h.com', userId: 'u-fix' } });
    });

    it('تغيير إيميل موظف مربوط ما بيغيّر الربط', async () => {
      (prismaMock as any).staff.findFirst.mockResolvedValue({ id: 's1', userId: 'u-1' });
      (prismaMock as any).staff.update.mockImplementation(async ({ data }: any) => ({ id: 's1', userId: 'u-1', ...data }));
      const res = mockResponse();

      await updateStaff(mockRequest({ params: { id: 's1' }, body: { email: 'renamed@h.com' } }), res);

      expect((prismaMock as any).user.findFirst).not.toHaveBeenCalled();
      expect((prismaMock as any).staff.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { email: 'renamed@h.com' } });
      expect((res.json as jest.Mock).mock.calls[0][0].data.hasLogin).toBe(true);
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
