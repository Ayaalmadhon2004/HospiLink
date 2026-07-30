import { prismaMock } from '../mocks/prisma';
import { mockRoomEmit } from '../mocks/io';
import { mockRequest, mockResponse } from '../mocks/http';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
} from '../../src/controllers/notifications.controller';

describe('notifications.controller', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  describe('getNotifications', () => {
    it('يرفض بـ 401 لو ما في مستخدم مصادق عليه', async () => {
      const req = mockRequest({ user: undefined });
      const res = mockResponse();

      await getNotifications(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('يرجع الإشعارات مع عدد غير المقروء', async () => {
      prismaMock.notification.findMany.mockResolvedValue([{ id: 'n1' }] as any);
      prismaMock.notification.count.mockResolvedValue(3);

      const req = mockRequest({ user: { id: 'u1', email: 'a@a.com', role: 'ADMIN' } });
      const res = mockResponse();

      await getNotifications(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, unreadCount: 3 })
      );
    });

    it('يفلتر على غير المقروء فقط لو unreadOnly=true', async () => {
      prismaMock.notification.findMany.mockResolvedValue([]);
      prismaMock.notification.count.mockResolvedValue(0);

      const req = mockRequest({
        user: { id: 'u1', email: 'a@a.com', role: 'ADMIN' },
        query: { unreadOnly: 'true' },
      });
      const res = mockResponse();

      await getNotifications(req, res);

      const whereArg = (prismaMock.notification.findMany.mock.calls[0][0] as any).where;
      expect(whereArg).toEqual({ userId: 'u1', read: false });
    });
  });

  describe('markAsRead', () => {
    it('يرفض بـ 401 لو ما في مستخدم', async () => {
      const req = mockRequest({ user: undefined, params: { id: 'n1' } });
      const res = mockResponse();

      await markAsRead(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('يحدث الإشعار المحدد لنفس المستخدم بس', async () => {
      prismaMock.notification.updateMany.mockResolvedValue({ count: 1 } as any);

      const req = mockRequest({
        user: { id: 'u1', email: 'a@a.com', role: 'ADMIN' },
        params: { id: 'n1' },
      });
      const res = mockResponse();

      await markAsRead(req, res);

      expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'n1', userId: 'u1' },
        data: { read: true },
      });
    });
  });

  describe('markAllAsRead', () => {
    it('يحدث كل الإشعارات الغير مقروءة لنفس المستخدم', async () => {
      prismaMock.notification.updateMany.mockResolvedValue({ count: 5 } as any);

      const req = mockRequest({ user: { id: 'u1', email: 'a@a.com', role: 'ADMIN' } });
      const res = mockResponse();

      await markAllAsRead(req, res);

      expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', read: false },
        data: { read: true },
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('deleteNotification', () => {
    it('يحذف إشعار محدد لنفس المستخدم بس (ما بيسمح تحذف إشعار غيرك)', async () => {
      prismaMock.notification.deleteMany.mockResolvedValue({ count: 1 } as any);

      const req = mockRequest({
        user: { id: 'u1', email: 'a@a.com', role: 'ADMIN' },
        params: { id: 'n1' },
      });
      const res = mockResponse();

      await deleteNotification(req, res);

      expect(prismaMock.notification.deleteMany).toHaveBeenCalledWith({
        where: { id: 'n1', userId: 'u1' },
      });
    });
  });

  describe('createNotification (internal helper)', () => {
    it('ينشئ الإشعار ويبثه لغرفة المستخدم المحدد', async () => {
      prismaMock.notification.create.mockResolvedValue({ id: 'n1', userId: 'u1' } as any);

      const result = await createNotification({
        userId: 'u1',
        type: 'SYSTEM',
        title: 'Test',
        message: 'Hello',
      });

      expect(mockRoomEmit).toHaveBeenCalledWith(
        'user-u1',
        'new-notification',
        expect.objectContaining({ id: 'n1' })
      );
      expect(result).toEqual({ id: 'n1', userId: 'u1' });
    });

    it('يرجع null بدل ما يرمي استثناء لو فشل الإنشاء', async () => {
      prismaMock.notification.create.mockRejectedValue(new Error('DB error'));

      const result = await createNotification({
        userId: 'u1',
        type: 'SYSTEM',
        title: 'Test',
        message: 'Hello',
      });

      expect(result).toBeNull();
    });
  });
});
