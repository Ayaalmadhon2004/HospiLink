import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import { prismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse, mockNext } from '../mocks/http';
import { JWT_SECRET } from '../../src/config/jwt';
import { encryptSecret, decryptSecret } from '../../src/config/twoFactor';
import { login } from '../../src/controllers/auth.controller';
jest.mock('../../src/services/securityNotices', () => ({ sendSecurityNotice: jest.fn() }));
import { sendSecurityNotice } from '../../src/services/securityNotices';
import {
  twoFactorRegenerateRecoveryCodes,
  twoFactorLogin,
  twoFactorSetup,
  twoFactorEnable,
  twoFactorDisable,
} from '../../src/controllers/twoFactor.controller';
import { protect } from '../../src/middlewares/auth.middleware';

const SECRET = authenticator.generateSecret();
const challenge = (over: object = {}, opts: jwt.SignOptions = { expiresIn: '5m' }) =>
  jwt.sign({ uid: 'u1', purpose: '2fa', rememberMe: false, ...over }, JWT_SECRET, opts);

const baseUser = (over: object = {}) => ({
  id: 'u1',
  email: 'a@a.com',
  name: 'Dr. A',
  role: 'DOCTOR',
  password: 'hash',
  accountStatus: 'ACTIVE',
  emailVerifiedAt: new Date(),
  twoFactorEnabledAt: new Date(),
  twoFactorSecretEnc: encryptSecret(SECRET),
  twoFactorLastStep: null,
  twoFactorFailures: 0,
  twoFactorLockedUntil: null,
  hospital: { id: 'h1', name: 'H', location: 'L' },
  ...over,
});

describe('two-factor authentication', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (sendSecurityNotice as jest.Mock).mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  describe('login (password step)', () => {
    it('with 2FA enabled returns a challenge and sets no cookie', async () => {
      const hashed = await bcrypt.hash('correct-password', 4);
      prismaMock.user.findUnique.mockResolvedValue(baseUser({ password: hashed }));
      const res = mockResponse();

      await login(mockRequest({ body: { email: 'a@a.com', password: 'correct-password', rememberMe: true } }), res);

      expect(res.cookie).not.toHaveBeenCalled();
      const body = (res.json as jest.Mock).mock.calls[0][0];
      expect(body).toEqual({
        success: true,
        data: { twoFactorRequired: true, challengeToken: expect.any(String) },
        twoFactorRequired: true,
        challengeToken: expect.any(String),
      });
      expect(body.user).toBeUndefined();
      const decoded = jwt.verify(body.challengeToken, JWT_SECRET) as any;
      expect(decoded).toMatchObject({ uid: 'u1', purpose: '2fa', rememberMe: true });
      expect(decoded.exp - decoded.iat).toBe(300);
    });

    it('without 2FA logs in and never leaks secret fields', async () => {
      const hashed = await bcrypt.hash('correct-password', 4);
      prismaMock.user.findUnique.mockResolvedValue(
        baseUser({ password: hashed, twoFactorEnabledAt: null, twoFactorSecretEnc: 'enc', passwordChangedAt: new Date() }),
      );
      const res = mockResponse();

      await login(mockRequest({ body: { email: 'a@a.com', password: 'correct-password' } }), res);

      expect(res.cookie).toHaveBeenCalled();
      const { user } = (res.json as jest.Mock).mock.calls[0][0];
      for (const key of ['password', 'twoFactorSecretEnc', 'twoFactorLastStep', 'twoFactorFailures', 'twoFactorLockedUntil', 'passwordChangedAt', 'twoFactorEnabledAt']) {
        expect(user).not.toHaveProperty(key);
      }
      expect(user.twoFactorEnabled).toBe(false);
    });
  });

  describe('protect', () => {
    it('rejects a 2FA challenge token used as a session', async () => {
      const req = mockRequest({ headers: { authorization: `Bearer ${challenge()}` } as any });
      const res = mockResponse();
      const next = mockNext();

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('twoFactorLogin', () => {
    const body = (over: object = {}) => ({ challengeToken: challenge(), code: authenticator.generate(SECRET), ...over });

    it('400 for malformed input (no factor, both factors, bad code)', async () => {
      for (const b of [
        { challengeToken: challenge() },
        { challengeToken: challenge(), code: '123456', recoveryCode: 'abcde-12345' },
        { challengeToken: challenge(), code: '12ab56' },
      ]) {
        const res = mockResponse();
        await twoFactorLogin(mockRequest({ body: b }), res);
        expect(res.status).toHaveBeenCalledWith(400);
      }
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it.each([
      ['garbage', 'x'.repeat(30)],
      ['wrong purpose', jwt.sign({ uid: 'u1', purpose: 'other' }, JWT_SECRET, { expiresIn: '5m' })],
      ['a session token', jwt.sign({ userId: 'u1' }, JWT_SECRET, { expiresIn: '5m' })],
      ['expired', challenge({}, { expiresIn: -10 })],
    ])('401 for %s challenge', async (_n, token) => {
      const res = mockResponse();
      await twoFactorLogin(mockRequest({ body: { challengeToken: token, code: '123456' } }), res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('401 when the account is no longer active or 2FA was turned off', async () => {
      for (const over of [{ accountStatus: 'DISABLED' }, { twoFactorEnabledAt: null }, { emailVerifiedAt: null }]) {
        prismaMock.user.findUnique.mockResolvedValue(baseUser(over));
        const res = mockResponse();
        await twoFactorLogin(mockRequest({ body: body() }), res);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.cookie).not.toHaveBeenCalled();
      }
    });

    it('completes the login with a valid code and keeps the remember-me choice', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUser());
      prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.user.update.mockResolvedValue({});
      const res = mockResponse();

      await twoFactorLogin(mockRequest({ body: body({ challengeToken: challenge({ rememberMe: true }) }) }), res);

      expect(res.status).toHaveBeenCalledWith(200);
      const [, , opts] = (res.cookie as jest.Mock).mock.calls[0];
      expect(opts.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
      const json = (res.json as jest.Mock).mock.calls[0][0];
      expect(json.user.twoFactorEnabled).toBe(true);
      expect(json.user).not.toHaveProperty('twoFactorSecretEnc');
    });

    it('401 for a wrong code, and no cookie', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUser());
      prismaMock.user.update.mockResolvedValue({ twoFactorFailures: 1 });
      const wrong = authenticator.generate(SECRET) === '000000' ? '111111' : '000000';
      const res = mockResponse();

      await twoFactorLogin(mockRequest({ body: body({ code: wrong }) }), res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('401 for a replayed code', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUser());
      prismaMock.user.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.user.update.mockResolvedValue({ twoFactorFailures: 1 });
      const res = mockResponse();

      await twoFactorLogin(mockRequest({ body: body() }), res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('429 while locked', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUser({ twoFactorLockedUntil: new Date(Date.now() + 60_000) }));
      const res = mockResponse();

      await twoFactorLogin(mockRequest({ body: body() }), res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TWO_FACTOR_LOCKED' }));
    });

    it('accepts a recovery code', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUser());
      prismaMock.twoFactorRecoveryCode.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.user.update.mockResolvedValue({});
      const res = mockResponse();

      await twoFactorLogin(mockRequest({ body: { challengeToken: challenge(), recoveryCode: 'abcde-12345' } }), res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.cookie).toHaveBeenCalled();
    });
  });

  describe('twoFactorSetup', () => {
    it('stores the secret encrypted and returns the otpauth URL', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'user@test.com', twoFactorEnabledAt: null });
      prismaMock.user.update.mockResolvedValue({});
      const res = mockResponse();

      await twoFactorSetup(mockRequest(), res);

      const { data } = (res.json as jest.Mock).mock.calls[0][0];
      expect(data.otpauthUrl).toMatch(/^otpauth:\/\/totp\/HospiLink:user%40test\.com\?/);
      const stored = prismaMock.user.update.mock.calls[0][0].data.twoFactorSecretEnc;
      expect(stored).not.toContain(data.secret);
      expect(decryptSecret(stored)).toBe(data.secret);
    });

    it('409 when already enabled; 401 without a user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'x', twoFactorEnabledAt: new Date() });
      const res = mockResponse();
      await twoFactorSetup(mockRequest(), res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(prismaMock.user.update).not.toHaveBeenCalled();

      const res2 = mockResponse();
      await twoFactorSetup(mockRequest({ user: undefined }), res2);
      expect(res2.status).toHaveBeenCalledWith(401);
    });
  });

  describe('twoFactorEnable', () => {
    const pending = (over = {}) => ({
      id: 'user-1', email: 'a@a.com', twoFactorSecretEnc: encryptSecret(SECRET), twoFactorLastStep: null, twoFactorEnabledAt: null, ...over,
    });

    it('400 for a malformed code', async () => {
      const res = mockResponse();
      await twoFactorEnable(mockRequest({ body: { code: 'abc' } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('400 when setup was not started or the code is wrong', async () => {
      prismaMock.user.findUnique.mockResolvedValue(pending({ twoFactorSecretEnc: null }));
      const res = mockResponse();
      await twoFactorEnable(mockRequest({ body: { code: '123456' } }), res);
      expect(res.status).toHaveBeenCalledWith(400);

      prismaMock.user.findUnique.mockResolvedValue(pending());
      const wrong = authenticator.generate(SECRET) === '000000' ? '111111' : '000000';
      const res2 = mockResponse();
      await twoFactorEnable(mockRequest({ body: { code: wrong } }), res2);
      expect(res2.status).toHaveBeenCalledWith(400);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('409 when already enabled', async () => {
      prismaMock.user.findUnique.mockResolvedValue(pending({ twoFactorEnabledAt: new Date() }));
      const res = mockResponse();
      await twoFactorEnable(mockRequest({ body: { code: '123456' } }), res);
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('enables 2FA and returns 10 recovery codes once, storing only hashes', async () => {
      prismaMock.user.findUnique.mockResolvedValue(pending());
      prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
      const res = mockResponse();

      await twoFactorEnable(mockRequest({ body: { code: authenticator.generate(SECRET) } }), res);

      const { data } = (res.json as jest.Mock).mock.calls[0][0];
      expect(data.recoveryCodes).toHaveLength(10);
      const created = prismaMock.twoFactorRecoveryCode.createMany.mock.calls[0][0].data;
      expect(created).toHaveLength(10);
      expect(JSON.stringify(created)).not.toContain(data.recoveryCodes[0]);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ twoFactorEnabledAt: expect.any(Date) }) }),
      );
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(sendSecurityNotice).toHaveBeenCalledWith(expect.any(String), 'Two-factor authentication enabled', expect.any(String));
    });
  });

  describe('twoFactorDisable', () => {
    const enabledUser = async (over = {}) => baseUser({ id: 'user-1', password: await bcrypt.hash('pw-correct', 4), ...over });

    it('400 for malformed input', async () => {
      const res = mockResponse();
      await twoFactorDisable(mockRequest({ body: { password: 'x' } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('409 when 2FA is not enabled', async () => {
      prismaMock.user.findUnique.mockResolvedValue(await enabledUser({ twoFactorEnabledAt: null }));
      const res = mockResponse();
      await twoFactorDisable(mockRequest({ body: { password: 'pw-correct', code: '123456' } }), res);
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('400 for a wrong password, before any code is checked', async () => {
      prismaMock.user.findUnique.mockResolvedValue(await enabledUser());
      const res = mockResponse();
      await twoFactorDisable(mockRequest({ body: { password: 'nope', code: authenticator.generate(SECRET) } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
    });

    it('401 for a wrong code', async () => {
      prismaMock.user.findUnique.mockResolvedValue(await enabledUser());
      prismaMock.user.update.mockResolvedValue({ twoFactorFailures: 1 });
      const wrong = authenticator.generate(SECRET) === '000000' ? '111111' : '000000';
      const res = mockResponse();
      await twoFactorDisable(mockRequest({ body: { password: 'pw-correct', code: wrong } }), res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('clears the secret and recovery codes with password + code', async () => {
      prismaMock.user.findUnique.mockResolvedValue(await enabledUser());
      prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.user.update.mockResolvedValue({});
      const res = mockResponse();

      await twoFactorDisable(mockRequest({ body: { password: 'pw-correct', code: authenticator.generate(SECRET) } }), res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(prismaMock.user.update).toHaveBeenLastCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({ twoFactorSecretEnc: null, twoFactorEnabledAt: null }),
      });
      expect(prismaMock.twoFactorRecoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(sendSecurityNotice).toHaveBeenCalledWith('a@a.com', 'Two-factor authentication disabled', expect.any(String));
    });
  });

  describe('twoFactorRegenerateRecoveryCodes', () => {
    const enabledUser = async (over = {}) => baseUser({ id: 'user-1', password: await bcrypt.hash('pw-correct', 4), ...over });
    const goodBody = () => ({ password: 'pw-correct', code: authenticator.generate(SECRET) });

    it('400 for malformed input, 401 without a user', async () => {
      const res = mockResponse();
      await twoFactorRegenerateRecoveryCodes(mockRequest({ body: { password: 'x' } }), res);
      expect(res.status).toHaveBeenCalledWith(400);

      const res2 = mockResponse();
      await twoFactorRegenerateRecoveryCodes(mockRequest({ user: undefined, body: goodBody() }), res2);
      expect(res2.status).toHaveBeenCalledWith(401);
    });

    it('409 when 2FA is not enabled; 400 for a wrong password; 401 for a wrong code', async () => {
      prismaMock.user.findUnique.mockResolvedValue(await enabledUser({ twoFactorEnabledAt: null }));
      const res1 = mockResponse();
      await twoFactorRegenerateRecoveryCodes(mockRequest({ body: goodBody() }), res1);
      expect(res1.status).toHaveBeenCalledWith(409);

      prismaMock.user.findUnique.mockResolvedValue(await enabledUser());
      const res2 = mockResponse();
      await twoFactorRegenerateRecoveryCodes(mockRequest({ body: { ...goodBody(), password: 'nope' } }), res2);
      expect(res2.status).toHaveBeenCalledWith(400);

      prismaMock.user.update.mockResolvedValue({ twoFactorFailures: 1 });
      const wrong = authenticator.generate(SECRET) === '000000' ? '111111' : '000000';
      const res3 = mockResponse();
      await twoFactorRegenerateRecoveryCodes(mockRequest({ body: { password: 'pw-correct', code: wrong } }), res3);
      expect(res3.status).toHaveBeenCalledWith(401);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('replaces every recovery code, returns 10 new ones once and notifies the user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(await enabledUser());
      prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.user.update.mockResolvedValue({});
      const res = mockResponse();

      await twoFactorRegenerateRecoveryCodes(mockRequest({ body: goodBody() }), res);

      expect(prismaMock.twoFactorRecoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      const created = prismaMock.twoFactorRecoveryCode.createMany.mock.calls[0][0].data;
      expect(created).toHaveLength(10);
      const { data } = (res.json as jest.Mock).mock.calls[0][0];
      expect(data.recoveryCodes).toHaveLength(10);
      expect(JSON.stringify(created)).not.toContain(data.recoveryCodes[0]);
      expect(sendSecurityNotice).toHaveBeenCalledWith('a@a.com', 'Recovery codes regenerated', expect.any(String));
    });
  });

  describe('recovery code use at login', () => {
    it('notifies the user with the number of codes left', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUser());
      prismaMock.twoFactorRecoveryCode.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.twoFactorRecoveryCode.count.mockResolvedValue(7);
      prismaMock.user.update.mockResolvedValue({});

      await twoFactorLogin(mockRequest({ body: { challengeToken: challenge(), recoveryCode: 'abcde-12345' } }), mockResponse());

      expect(sendSecurityNotice).toHaveBeenCalledWith('a@a.com', 'A recovery code was used to sign in', expect.stringContaining('left: 7'));
    });

    it('sends nothing for a normal authenticator code', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUser());
      prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.user.update.mockResolvedValue({});

      await twoFactorLogin(mockRequest({ body: { challengeToken: challenge(), code: authenticator.generate(SECRET) } }), mockResponse());

      expect(sendSecurityNotice).not.toHaveBeenCalled();
    });
  });
});
