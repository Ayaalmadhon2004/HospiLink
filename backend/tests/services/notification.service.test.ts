import { prismaMock } from '../mocks/prisma';
import { mockRoomEmit } from '../mocks/io';
import { notify, DEFAULT_SETTINGS } from '../../src/services/notification.service';

const allOn = { ...DEFAULT_SETTINGS, shiftReminders: true };

describe('notification.service notify()', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    prismaMock.user.findUnique.mockResolvedValue({ hospitalId: 'h1' } as any);
    prismaMock.notification.createManyAndReturn.mockImplementation((async ({ data }: any) =>
      data.map((d: any, i: number) => ({ id: `n${i}`, ...d }))) as any);
  });
  afterEach(() => jest.restoreAllMocks());

  it('stores one row per recipient and emits to each user room', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'a', settings: null },
      { id: 'b', settings: allOn },
    ] as any);

    const res = await notify({
      type: 'INCIDENT', title: 'T', message: 'M', link: '/incidents',
      recipients: { roles: ['ADMIN'], excludeUserId: 'actor' },
    });

    expect(res).toHaveLength(2);
    expect(prismaMock.notification.createManyAndReturn).toHaveBeenCalledWith({
      data: [
        { userId: 'a', type: 'INCIDENT', title: 'T', message: 'M', link: '/incidents' },
        { userId: 'b', type: 'INCIDENT', title: 'T', message: 'M', link: '/incidents' },
      ],
    });
    expect(mockRoomEmit).toHaveBeenCalledWith('user-a', 'new-notification', expect.objectContaining({ id: 'n0' }));
    expect(mockRoomEmit).toHaveBeenCalledWith('user-b', 'new-notification', expect.objectContaining({ id: 'n1' }));
  });

  it('scopes to the hospital of the excluded actor and excludes the actor', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    await notify({ type: 'DISPATCH', title: 'T', message: 'M', recipients: { roles: ['DISPATCHER'], excludeUserId: 'actor' } });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'actor' } }));
    const where = (prismaMock.user.findMany.mock.calls[0][0] as any).where;
    expect(where.AND).toEqual(
      expect.arrayContaining([{ hospitalId: 'h1' }, { id: { not: 'actor' } }, { OR: [{ role: { in: ['DISPATCHER'] } }] }]),
    );
  });

  it('unions explicit userIds with the role+department match', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    await notify({
      type: 'VITALS', title: 'T', message: 'M',
      recipients: { roles: ['DOCTOR', 'NURSE'], department: 'ICU', userIds: ['doc1'], hospitalId: 'h1' },
    });
    const where = (prismaMock.user.findMany.mock.calls[0][0] as any).where;
    expect(where.AND[0]).toEqual({
      OR: [{ id: { in: ['doc1'] } }, { role: { in: ['DOCTOR', 'NURSE'] }, department: 'ICU' }],
    });
  });

  it('skips users who turned the category off and applies defaults when settings are missing', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'off', settings: { ...DEFAULT_SETTINGS, dispatchAlerts: false } },
      { id: 'default', settings: null },
    ] as any);
    await notify({ type: 'DISPATCH', title: 'T', message: 'M', recipients: { roles: ['ADMIN'], hospitalId: 'h1' } });
    expect(prismaMock.notification.createManyAndReturn).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: 'default' })],
    });
  });

  it('uses the schema default (off) for shiftReminders when settings are missing', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 'x', settings: null }] as any);
    const res = await notify({ type: 'SHIFT', title: 'T', message: 'M', recipients: { userIds: ['x'], hospitalId: 'h1' } });
    expect(res).toEqual([]);
    expect(prismaMock.notification.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('always delivers SYSTEM notifications regardless of settings', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'a', settings: { criticalVitalsAlerts: false, incidentEscalations: false, shiftReminders: false, dispatchAlerts: false, appointmentReminders: false } },
    ] as any);
    const res = await notify({ type: 'SYSTEM', title: 'T', message: 'M', recipients: { roles: ['ADMIN'], hospitalId: 'h1' } });
    expect(res).toHaveLength(1);
  });

  it('does nothing when the selector is empty', async () => {
    const res = await notify({ type: 'SYSTEM', title: 'T', message: 'M', recipients: { hospitalId: 'h1' } });
    expect(res).toEqual([]);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it('never throws: logs and returns [] on DB failure', async () => {
    prismaMock.user.findMany.mockRejectedValue(new Error('db down'));
    await expect(
      notify({ type: 'SYSTEM', title: 'T', message: 'M', recipients: { roles: ['ADMIN'], hospitalId: 'h1' } }),
    ).resolves.toEqual([]);
  });
});
