import crypto from 'node:crypto';
import { prismaMock } from '../mocks/prisma';
import { issueAuthToken, consumeAuthToken } from '../../src/services/authTokens';

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

describe('authTokens service', () => {
  it('issueAuthToken stores only the hash and invalidates older tokens of the same type', async () => {
    prismaMock.authToken.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.authToken.create.mockResolvedValue({} as any);

    const token = await issueAuthToken('u1', 'PASSWORD_RESET', 60_000);

    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(prismaMock.authToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', type: 'PASSWORD_RESET', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    const data = prismaMock.authToken.create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(sha256(token));
    expect(JSON.stringify(data)).not.toContain(token);
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  describe('consumeAuthToken', () => {
    const row = (over = {}) => ({
      id: 't1', userId: 'u1', type: 'PASSWORD_RESET', usedAt: null, expiresAt: new Date(Date.now() + 60_000), ...over,
    });

    it('returns the userId for a valid token and marks it used', async () => {
      prismaMock.authToken.findUnique.mockResolvedValue(row() as any);
      prismaMock.authToken.updateMany.mockResolvedValue({ count: 1 });

      await expect(consumeAuthToken('tok', 'PASSWORD_RESET')).resolves.toBe('u1');
      expect(prismaMock.authToken.findUnique).toHaveBeenCalledWith({ where: { tokenHash: sha256('tok') } });
    });

    it.each([
      ['unknown token', null],
      ['wrong type', row({ type: 'EMAIL_VERIFY' })],
      ['already used', row({ usedAt: new Date() })],
      ['expired', row({ expiresAt: new Date(Date.now() - 1000) })],
    ])('returns null for %s', async (_n, found) => {
      prismaMock.authToken.findUnique.mockResolvedValue(found as any);

      await expect(consumeAuthToken('tok', 'PASSWORD_RESET')).resolves.toBeNull();
      expect(prismaMock.authToken.updateMany).not.toHaveBeenCalled();
    });

    it('returns null when a concurrent request consumed it first', async () => {
      prismaMock.authToken.findUnique.mockResolvedValue(row() as any);
      prismaMock.authToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(consumeAuthToken('tok', 'PASSWORD_RESET')).resolves.toBeNull();
    });
  });
});
