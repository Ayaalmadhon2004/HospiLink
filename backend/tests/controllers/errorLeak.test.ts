import { prismaMock } from '../mocks/prisma';
import '../mocks/io';
import { mockRequest, mockResponse } from '../mocks/http';
import { getAllWards, getWardById } from '../../src/controllers/ward.controller';
import { getAllBeds, getBedById, deleteBed } from '../../src/controllers/bed.controller';
import { getStaff } from '../../src/controllers/staff.controller';
import { getVitals, getCriticalAlerts } from '../../src/controllers/vitals.controller';
import { getAllUnits } from '../../src/controllers/dispatch.controller';
import { getUserSettings } from '../../src/controllers/settings.controller';
import { getAppointments } from '../../src/controllers/appointments.controller';
import { getIncidents } from '../../src/controllers/incidents.controller';
import { getNotifications } from '../../src/controllers/notifications.controller';
import { getRecentPatients, getPatientById } from '../../src/controllers/patient.controller';
import { login, getMe } from '../../src/controllers/auth.controller';

const SECRET = 'secret db detail';

type Handler = (req: any, res: any) => Promise<unknown>;

// [name, handler, "model.method" that fails, request overrides]
const cases: Array<[string, Handler, string, Record<string, unknown>]> = [
  ['getAllWards', getAllWards, 'ward.findMany', {}],
  ['getWardById', getWardById, 'ward.findFirst', { params: { id: 'w1' } }],
  ['getAllBeds', getAllBeds, 'bed.findMany', {}],
  ['getBedById', getBedById, 'bed.findFirst', { params: { id: 'b1' } }],
  ['deleteBed', deleteBed, 'bed.findFirst', { params: { id: 'b1' } }],
  ['getStaff', getStaff, 'staff.findMany', {}],
  ['getVitals', getVitals, 'vital.findMany', { query: {} }],
  ['getCriticalAlerts', getCriticalAlerts, 'vital.findMany', { query: {} }],
  ['getAllUnits', getAllUnits, 'dispatchUnit.findMany', {}],
  ['getUserSettings', getUserSettings, 'user.findUnique', { user: { id: 'u1' } }],
  ['getAppointments', getAppointments, 'appointment.findMany', { query: {} }],
  ['getIncidents', getIncidents, 'incident.findMany', { query: {} }],
  ['getNotifications', getNotifications, 'notification.findMany', { user: { id: 'u1' }, query: {} }],
  ['getRecentPatients', getRecentPatients, 'patient.findMany', { query: {} }],
  ['getPatientById', getPatientById, 'patient.findFirst', { params: { id: 'p1' } }],
  ['login', login, 'user.findUnique', { body: { email: 'a@b.com', password: 'x' } }],
  ['getMe', getMe, 'user.findUnique', { user: { id: 'u1' } }],
];

// أي 500 لازم ما يرجّع رسالة الخطأ الداخلية للعميل
describe('500 responses never leak internal error messages', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(cases)('%s', async (_name, handler, target, reqOverrides) => {
    const [model, method] = target.split('.');
    (prismaMock as any)[model][method].mockRejectedValue(new Error(SECRET));

    const res = mockResponse();
    await handler(mockRequest(reqOverrides as any), res);

    expect(res.status).toHaveBeenCalledWith(500);
    const calls = (res.json as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    calls.forEach(([body]) => {
      expect(JSON.stringify(body)).not.toContain(SECRET);
      expect(body.success).toBe(false);
      expect(body).not.toHaveProperty('error');
    });
  });
});
