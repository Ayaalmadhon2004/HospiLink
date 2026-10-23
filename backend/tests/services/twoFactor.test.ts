import { authenticator } from 'otplib';
import { prismaMock } from '../mocks/prisma';
import { encryptSecret } from '../../src/config/twoFactor';
import {
  verifyTotp,
  verifySecondFactor,
  generateRecoveryCodes,
  MAX_FAILURES,
  RECOVERY_CODE_COUNT,
} from '../../src/services/twoFactor';

const SECRET = authenticator.generateSecret();
const user = (over = {}) => ({
  id: 'u1',
  twoFactorSecretEnc: encryptSecret(SECRET),
  twoFactorLastStep: null as number | null,
  twoFactorLockedUntil: null as Date | null,
  ...over,
});

describe('twoFactor service', () => {
  describe('verifyTotp', () => {
    it('accepts the current code and burns its time-step', async () => {
      prismaMock.user.updateMany.mockResolvedValue({ count: 1 });

      await expect(verifyTotp(user(), authenticator.generate(SECRET))).resolves.toBe(true);

      const arg = prismaMock.user.updateMany.mock.calls[0][0];
      expect(arg.where.id).toBe('u1');
      expect(arg.where.OR).toEqual([{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: expect.any(Number) } }]);
      expect(arg.data.twoFactorLastStep).toBeGreaterThan(0);
    });

    it('rejects a replayed code (the step was already used)', async () => {
      prismaMock.user.updateMany.mockResolvedValue({ count: 0 });
      await expect(verifyTotp(user(), authenticator.generate(SECRET))).resolves.toBe(false);
    });

    it('rejects a wrong code without touching the database', async () => {
      const wrong = authenticator.generate(SECRET) === '000000' ? '111111' : '000000';
      await expect(verifyTotp(user(), wrong)).resolves.toBe(false);
      expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
    });

    it('rejects when no secret is stored', async () => {
      await expect(verifyTotp(user({ twoFactorSecretEnc: null }), '123456')).resolves.toBe(false);
    });
  });

  describe('verifySecondFactor', () => {
    it('refuses while the account is locked, without checking the code', async () => {
      const locked = user({ twoFactorLockedUntil: new Date(Date.now() + 60_000) });
      await expect(verifySecondFactor(locked, { code: authenticator.generate(SECRET) })).resolves.toBe('locked');
      expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
    });

    it('a valid code resets the failure counter', async () => {
      prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.user.update.mockResolvedValue({});

      await expect(verifySecondFactor(user(), { code: authenticator.generate(SECRET) })).resolves.toBe('ok');
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { twoFactorFailures: 0, twoFactorLockedUntil: null },
      });
    });

    it('a recovery code works once (updateMany on unused hash)', async () => {
      prismaMock.twoFactorRecoveryCode.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.user.update.mockResolvedValue({});

      await expect(verifySecondFactor(user(), { recoveryCode: 'ABCDE-12345' })).resolves.toBe('ok');
      const arg = prismaMock.twoFactorRecoveryCode.updateMany.mock.calls[0][0];
      expect(arg.where).toEqual({ userId: 'u1', codeHash: expect.stringMatching(/^[a-f0-9]{64}$/), usedAt: null });

      prismaMock.twoFactorRecoveryCode.updateMany.mockResolvedValue({ count: 0 });
      await expect(verifySecondFactor(user(), { recoveryCode: 'ABCDE-12345' })).resolves.toBe('invalid');
    });

    it('the recovery code hash ignores case and the dash', async () => {
      prismaMock.twoFactorRecoveryCode.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.user.update.mockResolvedValue({});
      await verifySecondFactor(user(), { recoveryCode: 'ABCDE-12345' });
      await verifySecondFactor(user(), { recoveryCode: 'abcde12345' });
      const [a, b] = prismaMock.twoFactorRecoveryCode.updateMany.mock.calls.map((c: any) => c[0].where.codeHash);
      expect(a).toBe(b);
    });

    it('counts a failure and reports invalid below the limit', async () => {
      prismaMock.user.update.mockResolvedValue({ twoFactorFailures: 2 });
      await expect(verifySecondFactor(user(), { code: '000000' })).resolves.toBe('invalid');
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { twoFactorFailures: { increment: 1 } },
        select: { twoFactorFailures: true },
      });
      expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
    });

    it(`locks the account for 15 minutes after ${MAX_FAILURES} failures`, async () => {
      prismaMock.user.update.mockResolvedValueOnce({ twoFactorFailures: MAX_FAILURES }).mockResolvedValueOnce({});
      await expect(verifySecondFactor(user(), { code: '000000' })).resolves.toBe('locked');
      const lock = prismaMock.user.update.mock.calls[1][0];
      expect(lock.data.twoFactorFailures).toBe(0);
      expect(lock.data.twoFactorLockedUntil.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    });
  });

  it('generateRecoveryCodes returns unique xxxxx-xxxxx codes and matching hashes', () => {
    const { plain, hashes } = generateRecoveryCodes();
    expect(plain).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(plain).size).toBe(RECOVERY_CODE_COUNT);
    plain.forEach((c) => expect(c).toMatch(/^[a-f0-9]{5}-[a-f0-9]{5}$/));
    expect(hashes).toHaveLength(RECOVERY_CODE_COUNT);
    hashes.forEach((h) => expect(h).toMatch(/^[a-f0-9]{64}$/));
  });
});
