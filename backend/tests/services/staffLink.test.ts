import bcrypt from 'bcryptjs';
import { prismaMock } from '../mocks/prisma';
import { linkStaffToUserByEmail, randomPasswordHash } from '../../src/services/staffLink';

const user = { id: 'u1', email: 'Doc@H.com', hospitalId: 'h1' };

describe('staffLink service', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('links an unlinked staff record of the same hospital, matching the email case-insensitively', async () => {
    prismaMock.staff.findFirst.mockResolvedValue({ id: 's1' });
    prismaMock.staff.update.mockResolvedValue({});

    await expect(linkStaffToUserByEmail(user)).resolves.toBe(true);
    expect(prismaMock.staff.findFirst).toHaveBeenCalledWith({
      where: { hospitalId: 'h1', userId: null, email: { equals: 'Doc@H.com', mode: 'insensitive' } },
      select: { id: true },
    });
    expect(prismaMock.staff.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { userId: 'u1' } });
  });

  it('does nothing when there is no candidate', async () => {
    prismaMock.staff.findFirst.mockResolvedValue(null);
    await expect(linkStaffToUserByEmail(user)).resolves.toBe(false);
    expect(prismaMock.staff.update).not.toHaveBeenCalled();
  });

  it('never throws (e.g. unique violation)', async () => {
    prismaMock.staff.findFirst.mockResolvedValue({ id: 's1' });
    prismaMock.staff.update.mockRejectedValue(new Error('P2002'));
    await expect(linkStaffToUserByEmail(user)).resolves.toBe(false);
  });

  it('randomPasswordHash is a bcrypt hash and differs each time', async () => {
    const [a, b] = [await randomPasswordHash(), await randomPasswordHash()];
    expect(a).toMatch(/^\$2[aby]\$/);
    expect(a).not.toBe(b);
    expect(await bcrypt.compare('password', a)).toBe(false);
  });
});
