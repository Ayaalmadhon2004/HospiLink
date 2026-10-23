// Event wiring: which controller action notifies whom (see docs/NOTIFICATIONS.md).
import { prismaMock } from '../mocks/prisma';
import { mockRoomEmit } from '../mocks/io';
import { mockRequest, mockResponse } from '../mocks/http';
import { recordVitals, updateVitals } from '../../src/controllers/vitals.controller';
import { createCall, assignUnitToCall } from '../../src/controllers/dispatch.controller';
import { createAppointment, updateAppointment, deleteAppointment } from '../../src/controllers/appointments.controller';
import { broadcastNotification } from '../../src/controllers/notifications.controller';

const actor = { id: 'actor', email: 'a@a.com', role: 'NURSE', hospitalId: 'hosp-1' };
const whereOf = () => JSON.stringify((prismaMock.user.findMany.mock.calls[0][0] as any).where);

describe('notification events', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    prismaMock.user.findUnique.mockResolvedValue({ hospitalId: 'h1', id: 'doc-user' } as any);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'r1', settings: null }] as any);
    prismaMock.notification.createManyAndReturn.mockImplementation((async ({ data }: any) =>
      data.map((d: any, i: number) => ({ id: `n${i}`, ...d }))) as any);
  });
  afterEach(() => jest.restoreAllMocks());

  describe('critical vitals', () => {
    const critical = () => {
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1', name: 'Sam', department: 'ICU', doctorId: 'doc1', hospitalId: 'hosp-1' } as any);
      (prismaMock as any).vitalThresholds.findMany.mockResolvedValue([
        { vitalType: 'HEART_RATE', minCritical: 40, maxCritical: 130, alertEnabled: true },
      ]);
    };

    it('notifies assigned doctor + ICU doctors/nurses with type VITALS', async () => {
      critical();
      prismaMock.patientVitals.create.mockResolvedValue({ id: 'v1', patientId: 'p1' } as any);
      await recordVitals(mockRequest({ user: actor, body: { patientId: 'p1', heartRate: 170 } }), mockResponse());

      const w = whereOf();
      expect(w).toContain('"id":{"in":["doc1"]}');
      expect(w).toContain('"hospitalId":"hosp-1"'); // never spans hospitals
      expect(w).toContain('"department":"ICU"');
      expect(prismaMock.notification.createManyAndReturn).toHaveBeenCalledWith({
        data: [expect.objectContaining({ type: 'VITALS', link: '/patients/p1' })],
      });
    });

    it('does not notify for normal readings', async () => {
      critical();
      prismaMock.patientVitals.create.mockResolvedValue({ id: 'v1', patientId: 'p1' } as any);
      await recordVitals(mockRequest({ user: actor, body: { patientId: 'p1', heartRate: 80 } }), mockResponse());
      expect(prismaMock.notification.createManyAndReturn).not.toHaveBeenCalled();
    });

    it('still answers 201 if notifying fails', async () => {
      critical();
      prismaMock.user.findMany.mockRejectedValue(new Error('x'));
      prismaMock.patientVitals.create.mockResolvedValue({ id: 'v1', patientId: 'p1' } as any);
      const res = mockResponse();
      await recordVitals(mockRequest({ user: actor, body: { patientId: 'p1', heartRate: 170 } }), res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('updateVitals notifies only when the reading becomes critical', async () => {
      critical();
      prismaMock.patientVitals.findFirst.mockResolvedValue({
        id: 'v1', isCritical: false, heartRate: 80, patient: { id: 'p1', name: 'Sam', department: 'ICU', doctorId: null, hospitalId: 'hosp-1' },
      } as any);
      prismaMock.patientVitals.update.mockResolvedValue({ id: 'v1' } as any);
      await updateVitals(mockRequest({ user: actor, params: { id: 'v1' }, body: { heartRate: 170 } }), mockResponse());
      expect(prismaMock.notification.createManyAndReturn).toHaveBeenCalledTimes(1);

      prismaMock.notification.createManyAndReturn.mockClear();
      prismaMock.patientVitals.findFirst.mockResolvedValue({
        id: 'v1', isCritical: true, heartRate: 170, patient: { id: 'p1', name: 'Sam', department: 'ICU', doctorId: null, hospitalId: 'hosp-1' },
      } as any);
      await updateVitals(mockRequest({ user: actor, params: { id: 'v1' }, body: { heartRate: 175 } }), mockResponse());
      expect(prismaMock.notification.createManyAndReturn).not.toHaveBeenCalled();
    });
  });

  describe('dispatch', () => {
    it('createCall notifies DISPATCHER + ADMIN except the actor', async () => {
      prismaMock.dispatchCall.create.mockResolvedValue({ id: 'c1', priority: 'HIGH' } as any);
      await createCall(
        mockRequest({ user: actor, body: { type: 'Cardiac', location: 'Gate 2', priority: 'HIGH' } }),
        mockResponse(),
      );
      expect(whereOf()).toContain('"role":{"in":["DISPATCHER","ADMIN"]}');
      expect(whereOf()).toContain('"not":"actor"');
      expect(prismaMock.notification.createManyAndReturn).toHaveBeenCalledWith({
        data: [expect.objectContaining({ type: 'DISPATCH', link: '/dispatch' })],
      });
    });

    it('assignUnitToCall notifies dispatchers', async () => {
      prismaMock.$transaction.mockResolvedValue({
        updatedCall: { id: 'c1', type: 'Cardiac', location: 'Gate 2' },
        updatedUnit: { id: 'u1', unitCode: 'AMB-1' },
      } as any);
      await assignUnitToCall(mockRequest({ user: actor, params: { id: 'c1' }, body: { unitId: 'u1' } }), mockResponse());
      expect(prismaMock.notification.createManyAndReturn).toHaveBeenCalledWith({
        data: [expect.objectContaining({ title: 'Unit assigned to call' })],
      });
    });
  });

  describe('appointments', () => {
    const apt = { id: 'a1', doctorId: 's1', scheduledAt: new Date('2026-10-22T09:00:00Z'), patient: { name: 'Sam' } };
    beforeEach(() => {
      prismaMock.staff.findUnique.mockResolvedValue({ email: 'doc@h.com' } as any);
      prismaMock.user.findUnique.mockImplementation(((args: any) =>
        Promise.resolve(args.where.email ? { id: 'doc-user' } : { hospitalId: 'h1' })) as any);
      prismaMock.user.findMany.mockResolvedValue([{ id: 'doc-user', settings: null }] as any);
    });

    it('create notifies the doctor (Staff -> User by email)', async () => {
      prismaMock.staff.findFirst.mockResolvedValue({ id: 's1' } as any);
      prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1' } as any);
      prismaMock.appointment.findFirst.mockResolvedValue(null);
      prismaMock.appointment.create.mockResolvedValue(apt as any);
      await createAppointment(
        mockRequest({ user: actor, body: { patientId: 'p1', doctorId: 's1', scheduledAt: '2026-10-22T09:00:00Z', type: 'X', department: 'ER' } }),
        mockResponse(),
      );
      expect(whereOf()).toContain('"id":{"in":["doc-user"]}');
      expect(prismaMock.notification.createManyAndReturn).toHaveBeenCalledWith({
        data: [expect.objectContaining({ type: 'APPOINTMENT', title: 'New appointment', userId: 'doc-user' })],
      });
    });

    it('update notifies on schedule changes but not on notes-only edits', async () => {
      prismaMock.appointment.findFirst.mockResolvedValue({ id: 'a1' } as any);
      prismaMock.appointment.update.mockResolvedValue(apt as any);
      await updateAppointment(mockRequest({ user: actor, params: { id: 'a1' }, body: { notes: 'hi' } }), mockResponse());
      expect(prismaMock.notification.createManyAndReturn).not.toHaveBeenCalled();

      await updateAppointment(mockRequest({ user: actor, params: { id: 'a1' }, body: { scheduledAt: '2026-10-23T09:00:00Z' } }), mockResponse());
      expect(prismaMock.notification.createManyAndReturn).toHaveBeenCalledWith({
        data: [expect.objectContaining({ title: 'Appointment changed' })],
      });
    });

    it('cancel notifies the doctor', async () => {
      prismaMock.appointment.findFirst.mockResolvedValue({ id: 'a1' } as any);
      prismaMock.appointment.update.mockResolvedValue(apt as any);
      await deleteAppointment(mockRequest({ user: actor, params: { id: 'a1' } }), mockResponse());
      expect(prismaMock.notification.createManyAndReturn).toHaveBeenCalledWith({
        data: [expect.objectContaining({ title: 'Appointment cancelled' })],
      });
    });

    it('does not notify when the doctor has no login', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.appointment.findFirst.mockResolvedValue({ id: 'a1' } as any);
      prismaMock.appointment.update.mockResolvedValue(apt as any);
      await deleteAppointment(mockRequest({ user: actor, params: { id: 'a1' } }), mockResponse());
      expect(prismaMock.notification.createManyAndReturn).not.toHaveBeenCalled();
    });
  });

  describe('POST /notifications/broadcast', () => {
    const admin = { id: 'adm', email: 'x', role: 'ADMIN', hospitalId: 'h1' };

    it('401 without a user', async () => {
      const res = mockResponse();
      await broadcastNotification(mockRequest({ user: undefined, body: { title: 'T', message: 'M' } }), res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('sends a SYSTEM message to all roles of the admin hospital', async () => {
      prismaMock.user.findMany.mockResolvedValue([{ id: 'a', settings: null }, { id: 'b', settings: null }] as any);
      const res = mockResponse();
      await broadcastNotification(
        mockRequest({ user: admin, body: { title: 'Maintenance', message: 'Tonight', link: '/dashboard' } }),
        res,
      );
      expect(whereOf()).toContain('"hospitalId":"h1"');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { recipients: 2 } }));
      expect(mockRoomEmit).toHaveBeenCalledWith('user-a', 'new-notification', expect.objectContaining({ type: 'SYSTEM' }));
    });

    it('targets a single role when given', async () => {
      await broadcastNotification(mockRequest({ user: admin, body: { title: 'T', message: 'M', role: 'NURSE' } }), mockResponse());
      expect(whereOf()).toContain('"role":{"in":["NURSE"]}');
    });

    it('401 when the admin no longer exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      const res = mockResponse();
      await broadcastNotification(mockRequest({ user: admin, body: { title: 'T', message: 'M' } }), res);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
