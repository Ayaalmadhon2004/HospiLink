import bcrypt from 'bcryptjs';
import { prismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse } from '../mocks/http';
import { listUsers, inviteUser, approveUser, rejectUser, deactivateUser, resetUserTwoFactor } from '../../src/controllers/users.controller';

jest.mock('../../src/services/securityNotices', () => ({ sendSecurityNotice: jest.fn() }));
import { sendSecurityNotice } from '../../src/services/securityNotices';

describe('users.controller (ADMIN account administration)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  describe('listUsers', () => {
    it('lists only the admin hospital, optionally filtered by accountStatus', async () => {
      prismaMock.user.findMany.mockResolvedValue([{ id: 'p1' }] as any);
      const res = mockResponse();

      await listUsers(mockRequest({ query: { accountStatus: 'PENDING' } }), res);

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { hospitalId: 'hosp-1', accountStatus: 'PENDING' } })
      );
      // the password hash is never selected
      expect((prismaMock.user.findMany.mock.calls[0][0] as any).select.password).toBeUndefined();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('listUsers linkable', () => {
    it('linkable=true only returns logins without a staff record', async () => {
      prismaMock.user.findMany.mockResolvedValue([] as any);
      await listUsers(mockRequest({ query: { accountStatus: 'ACTIVE', linkable: 'true' } }), mockResponse());
      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { hospitalId: 'hosp-1', accountStatus: 'ACTIVE', staff: null } })
      );
    });
  });

  describe('resetUserTwoFactor', () => {
    it('400 for your own account (use the settings page)', async () => {
      const res = mockResponse();
      await resetUserTwoFactor(mockRequest({ params: { id: 'user-1' } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
    });

    it('404 for a user of another hospital, 409 when 2FA is off', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);
      const res1 = mockResponse();
      await resetUserTwoFactor(mockRequest({ params: { id: 'foreign' } }), res1);
      expect(prismaMock.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign', hospitalId: 'hosp-1' } }));
      expect(res1.status).toHaveBeenCalledWith(404);

      prismaMock.user.findFirst.mockResolvedValue({ id: 'u2', email: 'u2@h.com', twoFactorEnabledAt: null } as any);
      const res2 = mockResponse();
      await resetUserTwoFactor(mockRequest({ params: { id: 'u2' } }), res2);
      expect(res2.status).toHaveBeenCalledWith(409);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('clears 2FA, deletes recovery codes, revokes sessions and notifies the user', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'u2', email: 'u2@h.com', twoFactorEnabledAt: new Date() } as any);
      const res = mockResponse();

      await resetUserTwoFactor(mockRequest({ params: { id: 'u2' } }), res);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u2' },
        data: expect.objectContaining({ twoFactorSecretEnc: null, twoFactorEnabledAt: null, passwordChangedAt: expect.any(Date) }),
      });
      expect(prismaMock.twoFactorRecoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u2' } });
      expect(sendSecurityNotice).toHaveBeenCalledWith('u2@h.com', 'Two-factor authentication was reset', expect.any(String));
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('inviteUser', () => {
    const body = { email: 'new@h.com', password: 'secret123', name: 'New Doc', role: 'DOCTOR', department: 'ER', shift: 'DAY' };

    it('creates an ACTIVE user with the assigned role in the admin hospital, ignoring a body hospitalId', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({ id: 'u', role: 'DOCTOR' } as any);
      const res = mockResponse();

      await inviteUser(mockRequest({ body: { ...body, hospitalId: 'other-hospital' } }), res);

      const data = (prismaMock.user.create.mock.calls[0][0] as any).data;
      expect(data).toMatchObject({ role: 'DOCTOR', accountStatus: 'ACTIVE', hospitalId: 'hosp-1' });
      expect(data.password).not.toBe('secret123');
      expect(await bcrypt.compare('secret123', data.password)).toBe(true);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('links the new login to the unlinked Staff record of the same hospital and email', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({ id: 'u', email: 'new@h.com', hospitalId: 'hosp-1' } as any);
      prismaMock.staff.findFirst.mockResolvedValue({ id: 's1' } as any);

      await inviteUser(mockRequest({ body }), mockResponse());

      expect(prismaMock.staff.findFirst).toHaveBeenCalledWith({
        where: { hospitalId: 'hosp-1', userId: null, email: { equals: 'new@h.com', mode: 'insensitive' } },
        select: { id: true },
      });
      expect(prismaMock.staff.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { userId: 'u' } });
    });

    it('still succeeds when linking fails (never blocks the invite)', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({ id: 'u', email: 'new@h.com', hospitalId: 'hosp-1' } as any);
      prismaMock.staff.findFirst.mockResolvedValue({ id: 's1' } as any);
      prismaMock.staff.update.mockRejectedValue(new Error('unique'));
      const res = mockResponse();

      await inviteUser(mockRequest({ body }), res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('rejects a duplicate email with 400', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'x' } as any);
      const res = mockResponse();

      await inviteUser(mockRequest({ body }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
  });

  describe('approveUser', () => {
    it('activates a PENDING user of the same hospital with the chosen role', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'p1', accountStatus: 'PENDING' } as any);
      prismaMock.user.update.mockResolvedValue({ id: 'p1', accountStatus: 'ACTIVE', role: 'NURSE' } as any);
      const res = mockResponse();

      await approveUser(mockRequest({ params: { id: 'p1' }, body: { role: 'NURSE' } }), res);

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p1', hospitalId: 'hosp-1' } }));
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p1' }, data: { accountStatus: 'ACTIVE', role: 'NURSE' } })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('links the approved login to its Staff record', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'p1', accountStatus: 'PENDING' } as any);
      prismaMock.user.update.mockResolvedValue({ id: 'p1', email: 'p1@h.com', hospitalId: 'hosp-1' } as any);
      prismaMock.staff.findFirst.mockResolvedValue({ id: 's9' } as any);

      await approveUser(mockRequest({ params: { id: 'p1' }, body: { role: 'NURSE' } }), mockResponse());

      expect(prismaMock.staff.update).toHaveBeenCalledWith({ where: { id: 's9' }, data: { userId: 'p1' } });
    });

    it('404 for a user of another hospital', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);
      const res = mockResponse();

      await approveUser(mockRequest({ params: { id: 'foreign' }, body: { role: 'ADMIN' } }), res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('409 when the user is not pending', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'a1', accountStatus: 'ACTIVE' } as any);
      const res = mockResponse();

      await approveUser(mockRequest({ params: { id: 'a1' }, body: { role: 'ADMIN' } }), res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
  });

  describe('rejectUser', () => {
    it('disables a PENDING user; 404 for another hospital; 409 when not pending', async () => {
      prismaMock.user.findFirst.mockResolvedValueOnce({ id: 'p1', accountStatus: 'PENDING' } as any);
      prismaMock.user.update.mockResolvedValue({ id: 'p1', accountStatus: 'DISABLED' } as any);
      const ok = mockResponse();
      await rejectUser(mockRequest({ params: { id: 'p1' } }), ok);
      expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { accountStatus: 'DISABLED' } }));
      expect(ok.status).toHaveBeenCalledWith(200);

      prismaMock.user.findFirst.mockResolvedValueOnce(null);
      const missing = mockResponse();
      await rejectUser(mockRequest({ params: { id: 'foreign' } }), missing);
      expect(missing.status).toHaveBeenCalledWith(404);

      prismaMock.user.findFirst.mockResolvedValueOnce({ id: 'a', accountStatus: 'ACTIVE' } as any);
      const active = mockResponse();
      await rejectUser(mockRequest({ params: { id: 'a' } }), active);
      expect(active.status).toHaveBeenCalledWith(409);
    });
  });

  describe('deactivateUser', () => {
    it('refuses to deactivate yourself', async () => {
      const res = mockResponse();
      await deactivateUser(mockRequest({ params: { id: 'user-1' } }), res); // default test user id
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('disables a user of the same hospital; 404 for another hospital', async () => {
      prismaMock.user.findFirst.mockResolvedValueOnce({ id: 'u2' } as any);
      prismaMock.user.update.mockResolvedValue({ id: 'u2', accountStatus: 'DISABLED' } as any);
      const ok = mockResponse();
      await deactivateUser(mockRequest({ params: { id: 'u2' } }), ok);
      expect(ok.status).toHaveBeenCalledWith(200);

      prismaMock.user.findFirst.mockResolvedValueOnce(null);
      const missing = mockResponse();
      await deactivateUser(mockRequest({ params: { id: 'foreign' } }), missing);
      expect(missing.status).toHaveBeenCalledWith(404);
    });
  });
});
