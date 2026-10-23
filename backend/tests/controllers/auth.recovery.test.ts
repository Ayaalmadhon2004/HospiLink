import bcrypt from 'bcryptjs';
import { prismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse } from '../mocks/http';

jest.mock('../../src/services/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue(undefined),
  appLink: (path: string, token: string) => `https://app.test${path}#token=${token}`,
}));
jest.mock('../../src/services/authTokens', () => ({
  issueAuthToken: jest.fn().mockResolvedValue('raw-token-0123456789abcdef'),
  consumeAuthToken: jest.fn(),
}));

import { sendMail } from '../../src/services/mailer';
import { issueAuthToken, consumeAuthToken } from '../../src/services/authTokens';
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  updatePassword,
} from '../../src/controllers/auth.controller';

const flush = () => new Promise((r) => setImmediate(r));
const GENERIC = { success: true, message: 'If an account exists for this email, we have sent a message.' };
const VALID_TOKEN = 'a'.repeat(32);

describe('auth recovery flows', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (sendMail as jest.Mock).mockClear();
    (issueAuthToken as jest.Mock).mockClear();
    (consumeAuthToken as jest.Mock).mockReset();
  });
  afterEach(() => jest.restoreAllMocks());

  describe('register', () => {
    it('sends a verification email after creating the account', async () => {
      const req = mockRequest({
        body: { email: 'new@h.com', password: 'secret123', name: 'Sara', department: 'ER', shift: 'Day', hospitalCode: 'n1' },
      });
      const res = mockResponse();
      prismaMock.hospital.findUnique.mockResolvedValue({ id: 'h1' });
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({ id: 'u9', email: 'new@h.com' });

      await register(req, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(201);
      expect(issueAuthToken).toHaveBeenCalledWith('u9', 'EMAIL_VERIFY', expect.any(Number));
      expect(sendMail).toHaveBeenCalledWith('new@h.com', expect.any(String), expect.stringContaining('/verify-email#token='));
    });
  });

  describe('login', () => {
    it('refuses an unverified email with 403 EMAIL_NOT_VERIFIED and no cookie', async () => {
      const hashed = await bcrypt.hash('correct-password', 4);
      const req = mockRequest({ body: { email: 'a@a.com', password: 'correct-password' } });
      const res = mockResponse();
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'a@a.com', password: hashed, role: 'NURSE', accountStatus: 'ACTIVE', emailVerifiedAt: null, hospital: null,
      });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'EMAIL_NOT_VERIFIED' }));
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('400 for an invalid email', async () => {
      const res = mockResponse();
      await forgotPassword(mockRequest({ body: { email: 'nope' } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('sends a reset link for a known account', async () => {
      const res = mockResponse();
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@a.com', accountStatus: 'ACTIVE' });

      await forgotPassword(mockRequest({ body: { email: 'A@a.com' } }), res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(GENERIC);
      expect(issueAuthToken).toHaveBeenCalledWith('u1', 'PASSWORD_RESET', expect.any(Number));
      expect(sendMail).toHaveBeenCalledWith('a@a.com', expect.any(String), expect.stringContaining('/reset-password#token='));
    });

    it.each([
      ['unknown account', null],
      ['disabled account', { id: 'u1', email: 'a@a.com', accountStatus: 'DISABLED' }],
    ])('answers identically and sends nothing for %s', async (_n, found) => {
      const res = mockResponse();
      prismaMock.user.findUnique.mockResolvedValue(found);

      await forgotPassword(mockRequest({ body: { email: 'a@a.com' } }), res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(GENERIC);
      expect(sendMail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('400 for a short password and does not consume the token', async () => {
      const res = mockResponse();
      await resetPassword(mockRequest({ body: { token: VALID_TOKEN, password: 'short' } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(consumeAuthToken).not.toHaveBeenCalled();
    });

    it('400 for an invalid, expired or reused token', async () => {
      (consumeAuthToken as jest.Mock).mockResolvedValue(null);
      const res = mockResponse();
      await resetPassword(mockRequest({ body: { token: VALID_TOKEN, password: 'new-password1' } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('updates the password, revokes sessions and marks the email verified', async () => {
      (consumeAuthToken as jest.Mock).mockResolvedValue('u1');
      prismaMock.user.update.mockResolvedValue({});
      const res = mockResponse();

      await resetPassword(mockRequest({ body: { token: VALID_TOKEN, password: 'new-password1' } }), res);

      expect(consumeAuthToken).toHaveBeenCalledWith(VALID_TOKEN, 'PASSWORD_RESET');
      const { where, data } = prismaMock.user.update.mock.calls[0][0];
      expect(where).toEqual({ id: 'u1' });
      expect(await bcrypt.compare('new-password1', data.password)).toBe(true);
      expect(data.passwordChangedAt).toBeInstanceOf(Date);
      expect(data.emailVerifiedAt).toBeInstanceOf(Date);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('400 for a malformed token', async () => {
      const res = mockResponse();
      await verifyEmail(mockRequest({ body: { token: 'x' } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('400 for an invalid or expired token', async () => {
      (consumeAuthToken as jest.Mock).mockResolvedValue(null);
      const res = mockResponse();
      await verifyEmail(mockRequest({ body: { token: VALID_TOKEN } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('sets emailVerifiedAt for a valid token', async () => {
      (consumeAuthToken as jest.Mock).mockResolvedValue('u1');
      prismaMock.user.update.mockResolvedValue({});
      const res = mockResponse();

      await verifyEmail(mockRequest({ body: { token: VALID_TOKEN } }), res);

      expect(consumeAuthToken).toHaveBeenCalledWith(VALID_TOKEN, 'EMAIL_VERIFY');
      expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { emailVerifiedAt: expect.any(Date) } });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('resendVerification', () => {
    it('mails only unverified users, but answers the same for everyone', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({ id: 'u1', email: 'a@a.com', emailVerifiedAt: null });
      const res1 = mockResponse();
      await resendVerification(mockRequest({ body: { email: 'a@a.com' } }), res1);
      await flush();
      expect(res1.json).toHaveBeenCalledWith(GENERIC);
      expect(sendMail).toHaveBeenCalledTimes(1);

      (sendMail as jest.Mock).mockClear();
      prismaMock.user.findUnique.mockResolvedValueOnce({ id: 'u1', email: 'a@a.com', emailVerifiedAt: new Date() });
      const res2 = mockResponse();
      await resendVerification(mockRequest({ body: { email: 'a@a.com' } }), res2);
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      const res3 = mockResponse();
      await resendVerification(mockRequest({ body: { email: 'x@a.com' } }), res3);
      await flush();
      expect(res2.json).toHaveBeenCalledWith(GENERIC);
      expect(res3.json).toHaveBeenCalledWith(GENERIC);
      expect(sendMail).not.toHaveBeenCalled();
    });
  });

  describe('updatePassword', () => {
    it('400 when the new password is too short', async () => {
      const res = mockResponse();
      await updatePassword(mockRequest({ body: { currentPassword: 'old', newPassword: 'short' } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('re-issues the cookie so the current device stays signed in', async () => {
      const hashed = await bcrypt.hash('real-password', 4);
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'user@test.com', role: 'ADMIN', password: hashed });
      prismaMock.user.update.mockResolvedValue({});
      const res = mockResponse();

      await updatePassword(mockRequest({ body: { currentPassword: 'real-password', newPassword: 'new-password1' } }), res);

      expect(res.cookie).toHaveBeenCalledWith('token', expect.any(String), expect.objectContaining({ httpOnly: true }));
    });
  });
});
