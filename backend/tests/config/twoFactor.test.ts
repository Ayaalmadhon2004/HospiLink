import { encryptSecret, decryptSecret } from '../../src/config/twoFactor';

describe('twoFactor secret encryption', () => {
  const original = process.env.TWO_FACTOR_ENC_KEY;
  afterEach(() => {
    process.env.TWO_FACTOR_ENC_KEY = original;
  });

  it('round-trips and never stores the plain secret', () => {
    const stored = encryptSecret('JBSWY3DPEHPK3PXP');
    expect(stored).not.toContain('JBSWY3DPEHPK3PXP');
    expect(stored.split(':')).toHaveLength(3);
    expect(decryptSecret(stored)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('uses a fresh IV each time', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('detects tampering', () => {
    const [iv, tag, ct] = encryptSecret('secret').split(':');
    const flipped = Buffer.from(ct, 'base64url');
    flipped[0] ^= 1;
    expect(() => decryptSecret([iv, tag, flipped.toString('base64url')].join(':'))).toThrow();
  });

  it('rejects a malformed value', () => {
    expect(() => decryptSecret('not-valid')).toThrow();
  });

  it('refuses to work without a 32-byte key', () => {
    process.env.TWO_FACTOR_ENC_KEY = Buffer.alloc(8).toString('base64');
    expect(() => encryptSecret('x')).toThrow(/32 bytes/);
    delete process.env.TWO_FACTOR_ENC_KEY;
    expect(() => encryptSecret('x')).toThrow(/32 bytes/);
  });
});
