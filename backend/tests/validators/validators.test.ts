import { idSchema } from '../../src/validators/common.validator';
import { createAppointmentSchema, updateAppointmentSchema } from '../../src/validators/appointment.validator';
import { createBedSchema, updateBedSchema } from '../../src/validators/bed.validator';
import { recordVitalsSchema, updateVitalsSchema, vitalsQuerySchema } from '../../src/validators/vitals.validator';
import { createStaffSchema, updateStaffSchema, createShiftSchema, updateShiftSchema } from '../../src/validators/staff.validator';
import { createIncidentSchema, updateIncidentStatusSchema } from '../../src/validators/incident.validator';
import { createCallSchema, assignUnitSchema, updateUnitStatusSchema } from '../../src/validators/dispatch.validator';
import { notificationsQuerySchema } from '../../src/validators/notification.validator';
import { updateDisplaySettingsSchema, updateProfileSchema, updateSecuritySettingsSchema } from '../../src/validators/settings.validator';

const U1 = '3f2b8c1e-6f0a-4a57-9a39-1c1d8b3f7a10';
const U2 = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

describe('common', () => {
  it('idSchema requires a uuid', () => {
    expect(idSchema.safeParse(U1).success).toBe(true);
    expect(idSchema.safeParse('').success).toBe(false);
    expect(idSchema.safeParse('abc').success).toBe(false);
  });
});

describe('appointments', () => {
  const base = { doctorId: U1, scheduledAt: '2026-10-20T09:00:00.000Z', type: 'CONSULTATION' };
  it('accepts the payload the UI sends and strips unknown keys', () => {
    const r = createAppointmentSchema.parse({ ...base, patientId: U2, patientName: 'Ann', patientCode: 'PT-1', department: 'ER', duration: 30, evil: 1 });
    expect(r).not.toHaveProperty('evil');
    expect(r.duration).toBe(30);
  });
  it('rejects bad doctorId, date and duration', () => {
    expect(createAppointmentSchema.safeParse({ ...base, doctorId: 'x' }).success).toBe(false);
    expect(createAppointmentSchema.safeParse({ ...base, scheduledAt: 'nope' }).success).toBe(false);
    expect(createAppointmentSchema.safeParse({ ...base, duration: 0 }).success).toBe(false);
    expect(createAppointmentSchema.safeParse({ doctorId: U1 }).success).toBe(false);
  });
  it('update strips patientName/patientCode (not columns)', () => {
    expect(updateAppointmentSchema.parse({ patientName: 'x', patientCode: 'y', room: 'C-1' })).toEqual({ room: 'C-1' });
  });
});

describe('beds', () => {
  it('create requires bedNumber, wardId and strips hospitalId', () => {
    expect(createBedSchema.safeParse({ bedNumber: 'ICU-1', wardId: U1, status: 'AVAILABLE' }).success).toBe(true);
    expect(createBedSchema.parse({ bedNumber: 'ICU-1', wardId: U1, hospitalId: U2 })).not.toHaveProperty('hospitalId');
    expect(createBedSchema.safeParse({ bedNumber: 'ICU-1' }).success).toBe(false);
    expect(createBedSchema.safeParse({ bedNumber: 'ICU-1', wardId: U1, status: 'BROKEN' }).success).toBe(false);
  });
  it('update allows patientId uuid / null / empty string', () => {
    expect(updateBedSchema.safeParse({ patientId: U1 }).success).toBe(true);
    expect(updateBedSchema.safeParse({ patientId: null }).success).toBe(true);
    expect(updateBedSchema.safeParse({ patientId: '' }).success).toBe(true);
    expect(updateBedSchema.safeParse({ patientId: 'bad' }).success).toBe(false);
  });
});

describe('vitals', () => {
  it('accepts numbers and numeric strings, strips server-controlled fields', () => {
    const r = recordVitalsSchema.parse({ patientId: U1, heartRate: '80', spO2: 97.5, temperature: 37, recordedBy: 'hacker', isCritical: true });
    expect(r).toMatchObject({ patientId: U1, heartRate: 80, spO2: 97.5, temperature: 37 });
    expect(r).not.toHaveProperty('recordedBy');
    expect(r).not.toHaveProperty('isCritical');
  });
  it('rejects out of range / non numeric values', () => {
    expect(recordVitalsSchema.safeParse({ patientId: U1, spO2: 150 }).success).toBe(false);
    expect(recordVitalsSchema.safeParse({ patientId: U1, heartRate: 'abc' }).success).toBe(false);
    expect(recordVitalsSchema.safeParse({ heartRate: 80 }).success).toBe(false);
  });
  it('update cannot change patientId', () => {
    expect(updateVitalsSchema.parse({ patientId: U1, heartRate: 70 })).toEqual({ heartRate: 70 });
  });
  it('query', () => {
    expect(vitalsQuerySchema.safeParse({ patientId: U1, critical: 'true', limit: '20' }).success).toBe(true);
    expect(vitalsQuerySchema.safeParse({ critical: 'maybe' }).success).toBe(false);
    expect(vitalsQuerySchema.safeParse({ limit: '-1' }).success).toBe(false);
  });
});

describe('staff & shifts', () => {
  const staff = { name: 'Dr A', email: 'A@x.com', role: 'Surgeon', department: 'ER' };
  it('maps UI status to isActive and strips shiftStart/shiftEnd', () => {
    const r = createStaffSchema.parse({ ...staff, status: 'ON_LEAVE', shiftStart: '08:00', shiftEnd: '16:00' });
    expect(r).toMatchObject({ email: 'a@x.com', isActive: false });
    expect(r).not.toHaveProperty('status');
    expect(r).not.toHaveProperty('shiftStart');
    expect(updateStaffSchema.parse({ status: 'ACTIVE' })).toEqual({ isActive: true });
  });
  it('rejects invalid staff', () => {
    expect(createStaffSchema.safeParse({ ...staff, email: 'bad' }).success).toBe(false);
    expect(createStaffSchema.safeParse({ name: 'x' }).success).toBe(false);
  });
  const shift = { staffId: U1, type: 'MORNING', startTime: '2026-10-20T08:00:00Z', endTime: '2026-10-20T16:00:00Z', department: 'ER' };
  it('shift: valid, end before start, bad staffId', () => {
    expect(createShiftSchema.safeParse(shift).success).toBe(true);
    expect(createShiftSchema.safeParse({ ...shift, endTime: '2026-10-20T07:00:00Z' }).success).toBe(false);
    expect(createShiftSchema.safeParse({ ...shift, staffId: 'x' }).success).toBe(false);
    expect(updateShiftSchema.safeParse({ notes: 'n' }).success).toBe(true);
  });
});

describe('incidents', () => {
  const inc = { title: 'Fall', type: 'PATIENT_FALL', severity: 'LOW', location: 'Ward 1', reportedBy: 'Nurse', description: 'd' };
  it('create', () => {
    expect(createIncidentSchema.safeParse(inc).success).toBe(true);
    expect(createIncidentSchema.safeParse({ ...inc, title: '' }).success).toBe(false);
  });
  it('status', () => {
    expect(updateIncidentStatusSchema.safeParse({ status: 'RESOLVED', progress: 100 }).success).toBe(true);
    expect(updateIncidentStatusSchema.safeParse({ status: 'WHATEVER' }).success).toBe(false);
    expect(updateIncidentStatusSchema.safeParse({ status: 'ACTIVE', progress: 101 }).success).toBe(false);
  });
});

describe('dispatch', () => {
  it('call', () => {
    expect(createCallSchema.safeParse({ type: 'Cardiac', location: 'Main St', priority: 'CRITICAL' }).success).toBe(true);
    expect(createCallSchema.safeParse({ type: 'Cardiac', location: 'Main St', priority: 'URGENT' }).success).toBe(false);
    expect(createCallSchema.safeParse({ type: 'Cardiac' }).success).toBe(false);
  });
  it('assign + unit status', () => {
    expect(assignUnitSchema.safeParse({ unitId: U1 }).success).toBe(true);
    expect(assignUnitSchema.safeParse({ unitId: '1' }).success).toBe(false);
    expect(updateUnitStatusSchema.safeParse({ status: 'ON_SCENE', location: { lat: 1, lng: 2 }, eta: 5, callId: null }).success).toBe(true);
    expect(updateUnitStatusSchema.safeParse({ status: 'FLYING' }).success).toBe(false);
  });
});

describe('notifications & settings', () => {
  it('notifications query', () => {
    expect(notificationsQuerySchema.safeParse({ limit: '20', unreadOnly: 'true' }).success).toBe(true);
    expect(notificationsQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(notificationsQuerySchema.safeParse({ limit: 'x' }).success).toBe(false);
  });
  it('settings', () => {
    expect(updateProfileSchema.parse({ name: ' Bob ', email: 'x@y.z', role: 'ADMIN' })).toEqual({ name: 'Bob' });
    expect(updateSecuritySettingsSchema.safeParse({ twoFactorAuth: 'yes' }).success).toBe(false);
    expect(updateDisplaySettingsSchema.safeParse({ theme: 'dark', language: 'en', timezone: 'UTC' }).success).toBe(true);
    expect(updateDisplaySettingsSchema.safeParse({ theme: 'neon' }).success).toBe(false);
  });
});
