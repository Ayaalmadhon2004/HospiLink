import { prismaMock } from '../mocks/prisma';
import { mockRoomEmit } from '../mocks/io';
import { sendShiftReminders, sendAppointmentReminders } from '../../src/services/reminders.service';

const now = new Date('2026-10-21T10:00:00Z');
const shift = {
  id: 's1', type: 'NIGHT', department: 'ICU', startTime: new Date('2026-10-21T10:20:00Z'),
  staff: { email: 'nurse@h.com', isActive: true },
};
const appt = {
  id: 'a1', type: 'Checkup', scheduledAt: new Date('2026-10-21T10:15:00Z'),
  doctor: { email: 'doc@h.com' }, patient: { name: 'Sam Lee' },
};

describe('reminders.service', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' } as any);
    prismaMock.notification.findFirst.mockResolvedValue(null);
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

  it('skips a shift already notified', async () => {
    prismaMock.shift.findMany.mockResolvedValue([shift] as any);
    prismaMock.notification.findFirst.mockResolvedValue({ id: 'old' } as any);
    expect(await sendShiftReminders(now)).toBe(0);
    expect(prismaMock.notification.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('delivers nothing when the shiftReminders setting is off', async () => {
    prismaMock.shift.findMany.mockResolvedValue([shift] as any);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u1', settings: { shiftReminders: false } }] as any);
    expect(await sendShiftReminders(now)).toBe(0);
    expect(prismaMock.notification.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('skips staff without a login', async () => {
    prismaMock.shift.findMany.mockResolvedValue([shift] as any);
    prismaMock.user.findUnique.mockResolvedValue(null);
    expect(await sendShiftReminders(now)).toBe(0);
    expect(prismaMock.notification.createManyAndReturn).not.toHaveBeenCalled();
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
    prismaMock.notification.findFirst.mockResolvedValue({ id: 'old' } as any);
    expect(await sendAppointmentReminders(now)).toBe(0);
    prismaMock.appointment.findMany.mockRejectedValue(new Error('db'));
    await expect(sendAppointmentReminders(now)).resolves.toBe(0);
  });
});
