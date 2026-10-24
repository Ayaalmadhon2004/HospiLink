import { prismaMock } from '../mocks/prisma';
import { mockRoomEmit } from '../mocks/io';
import { sendShiftReminders, sendAppointmentReminders, runReminders } from '../../src/services/reminders.service';

const now = new Date('2026-10-21T10:00:00Z');
const shift = {
  id: 's1', type: 'NIGHT', department: 'ICU', startTime: new Date('2026-10-21T10:20:00Z'),
  staff: { id: 'st1', userId: 'u1', isActive: true, hospitalId: 'h1' },
};
const appt = {
  id: 'a1', type: 'Checkup', scheduledAt: new Date('2026-10-21T10:15:00Z'),
  doctor: { id: 'st2', userId: 'u1', hospitalId: 'h1' }, patient: { name: 'Sam Lee' },
};

describe('reminders.service', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    prismaMock.reminderLog.createManyAndReturn.mockImplementation((async ({ data }: any) => data) as any);
    prismaMock.reminderLog.deleteMany.mockResolvedValue({ count: 0 } as any);
    prismaMock.hospital.findMany.mockResolvedValue([{ id: 'h1', timezone: 'Asia/Amman' }] as any);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u1', settings: { shiftReminders: true, appointmentReminders: true } }] as any);
    prismaMock.notification.createManyAndReturn.mockImplementation((async ({ data }: any) =>
      data.map((d: any, i: number) => ({ id: `n${i}`, ...d }))) as any);
  });
  afterEach(() => jest.restoreAllMocks());

  it('sends a due shift reminder', async () => {
    prismaMock.shift.findMany.mockResolvedValue([shift] as any);
    expect(await sendShiftReminders(now)).toBe(1);
    expect(prismaMock.notification.createManyAndReturn).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: 'u1', type: 'SHIFT', link: '/staff?shift=s1' })],
    });
    expect(mockRoomEmit).toHaveBeenCalledWith('user-u1', 'new-notification', expect.anything());
  });

  it('claims atomically through the unique key and words the time in the hospital zone', async () => {
    prismaMock.shift.findMany.mockResolvedValue([shift] as any);
    await sendShiftReminders(now);
    expect(prismaMock.reminderLog.createManyAndReturn).toHaveBeenCalledWith({
      data: [{ userId: 'u1', kind: 'SHIFT', dedupeKey: 's1' }],
      skipDuplicates: true,
      select: { userId: true, dedupeKey: true },
    });
    const msg = (prismaMock.notification.createManyAndReturn.mock.calls[0][0] as any).data[0].message;
    expect(msg).toContain('2026-10-21 13:20'); // 10:20Z in Asia/Amman (UTC+3)
    expect(msg).not.toContain('UTC');
  });

  it('releases the claim when nothing was delivered so a later run can retry', async () => {
    prismaMock.shift.findMany.mockResolvedValue([shift] as any);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u1', settings: { shiftReminders: false } }] as any);
    await sendShiftReminders(now);
    expect(prismaMock.reminderLog.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ userId: 'u1', kind: 'SHIFT', dedupeKey: 's1' }] },
    });
  });

  it('runReminders prunes old claims', async () => {
    prismaMock.shift.findMany.mockResolvedValue([]);
    prismaMock.appointment.findMany.mockResolvedValue([]);
    await runReminders(now);
    expect(prismaMock.reminderLog.deleteMany).toHaveBeenCalledWith({
      where: { sentAt: { lt: new Date('2026-10-14T10:00:00Z') } },
    });
  });

  it('skips a shift already notified', async () => {
    prismaMock.shift.findMany.mockResolvedValue([shift] as any);
    prismaMock.reminderLog.createManyAndReturn.mockResolvedValue([] as any);
    expect(await sendShiftReminders(now)).toBe(0);
    expect(prismaMock.notification.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('delivers nothing when the shiftReminders setting is off', async () => {
    prismaMock.shift.findMany.mockResolvedValue([shift] as any);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u1', settings: { shiftReminders: false } }] as any);
    expect(await sendShiftReminders(now)).toBe(0);
    expect(prismaMock.notification.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('skips staff without a linked login (and does not guess by email)', async () => {
    prismaMock.shift.findMany.mockResolvedValue([{ ...shift, staff: { ...shift.staff, userId: null } }] as any);
    expect(await sendShiftReminders(now)).toBe(0);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.notification.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('skips a doctor without a linked login', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([{ ...appt, doctor: { id: 'st2', userId: null } }] as any);
    expect(await sendAppointmentReminders(now)).toBe(0);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('sends a due appointment reminder to the doctor, excluding cancelled', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([appt] as any);
    expect(await sendAppointmentReminders(now)).toBe(1);
    expect(prismaMock.appointment.findMany.mock.calls[0][0].where.status).toEqual({ not: 'CANCELLED' });
    expect(prismaMock.notification.createManyAndReturn).toHaveBeenCalledWith({
      data: [expect.objectContaining({ type: 'APPOINTMENT', link: `/appointments?reminder=a1-${appt.scheduledAt.getTime()}` })],
    });
  });

  it('skips an appointment already notified, and never throws on DB errors', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([appt] as any);
    prismaMock.reminderLog.createManyAndReturn.mockResolvedValue([] as any);
    expect(await sendAppointmentReminders(now)).toBe(0);
    prismaMock.appointment.findMany.mockRejectedValue(new Error('db'));
    await expect(sendAppointmentReminders(now)).resolves.toBe(0);
  });

  it('batches many reminders into one claim, one timezone lookup, one user lookup and one insert', async () => {
    const shifts = ['a', 'b', 'c'].map((id, i) => ({
      ...shift, id, staff: { ...shift.staff, id: `st${i}`, userId: `u${i}` },
    }));
    prismaMock.shift.findMany.mockResolvedValue(shifts as any);
    prismaMock.user.findMany.mockResolvedValue(
      shifts.map((s) => ({ id: s.staff.userId, settings: { shiftReminders: true } })) as any);

    expect(await sendShiftReminders(now)).toBe(3);
    expect(prismaMock.reminderLog.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(prismaMock.hospital.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.notification.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(prismaMock.hospital.findUnique).not.toHaveBeenCalled();
  });

  it('releases only the claims that delivered nothing, in one delete', async () => {
    const shifts = [shift, { ...shift, id: 's2', staff: { ...shift.staff, id: 'st9', userId: 'u2' } }];
    prismaMock.shift.findMany.mockResolvedValue(shifts as any);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', settings: { shiftReminders: true } },
      { id: 'u2', settings: { shiftReminders: false } },
    ] as any);

    expect(await sendShiftReminders(now)).toBe(1);
    expect(prismaMock.reminderLog.deleteMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.reminderLog.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ userId: 'u2', kind: 'SHIFT', dedupeKey: 's2' }] },
    });
  });
});
