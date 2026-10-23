import { prismaMock } from '../mocks/prisma';
import { mockRoomEmit } from '../mocks/io';
import { mockRequest, mockResponse } from '../mocks/http';
import {
  getIncidents,
  getActiveIncidents,
  getIncidentById,
  createIncident,
  updateIncident,
  updateIncidentStatus,
  deleteIncident,
} from '../../src/controllers/incidents.controller';

describe('incidents.controller', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u2', settings: null }] as any);
    prismaMock.notification.createManyAndReturn.mockResolvedValue([{ id: 'n1', userId: 'u2' }] as any);
  });
  afterEach(() => jest.restoreAllMocks());

  describe('getIncidents', () => {
    it('يبني فلتر where فقط من الحقول المرسلة وغير الفاضية', async () => {
      prismaMock.incident.findMany.mockResolvedValue([]);
      const req = mockRequest({ query: { status: 'ACTIVE', severity: '', type: 'FIRE' } });
      const res = mockResponse();

      await getIncidents(req, res);

      const whereArg = (prismaMock.incident.findMany.mock.calls[0][0] as any).where;
      expect(whereArg).toEqual({ hospitalId: 'hosp-1', status: 'ACTIVE', type: 'FIRE' });
    });
  });

  describe('getActiveIncidents', () => {
    it('يصنف الحوادث حسب مستوى الخطورة', async () => {
      prismaMock.incident.findMany.mockResolvedValue([
        { id: '1', severity: 'CRITICAL' },
        { id: '2', severity: 'ELEVATED' },
        { id: '3', severity: 'MODERATE' },
        { id: '4', severity: 'CRITICAL' },
      ] as any);

      const req = mockRequest();
      const res = mockResponse();

      await getActiveIncidents(req, res);

      expect(prismaMock.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'ACTIVE', hospitalId: 'hosp-1' } })
      );
      const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonArg.data.critical).toHaveLength(2);
      expect(jsonArg.data.elevated).toHaveLength(1);
      expect(jsonArg.data.moderate).toHaveLength(1);
      expect(jsonArg.data.total).toBe(4);
    });
  });

  describe('getIncidentById', () => {
    it('يرجع 404 لو الحادث مش موجود', async () => {
      prismaMock.incident.findFirst.mockResolvedValue(null);
      const req = mockRequest({ params: { id: 'nope' } });
      const res = mockResponse();

      await getIncidentById(req, res);

      expect(prismaMock.incident.findFirst).toHaveBeenCalledWith({ where: { id: 'nope', hospitalId: 'hosp-1' } });
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('createIncident', () => {
    it('يولد كود جديد بصيغة INC-XXXX ويبث الحدث وينشئ إشعار', async () => {
      prismaMock.incident.count.mockResolvedValue(9);
      prismaMock.incident.create.mockResolvedValue({
        id: 'inc-1',
        code: 'INC-0100',
        title: 'Fire in Ward 3',
      } as any);

      const req = mockRequest({
        user: { id: 'u1', email: 'a@a.com', role: 'ADMIN', hospitalId: 'hosp-1' },
        body: { title: 'Fire in Ward 3', type: 'FIRE', severity: 'CRITICAL', location: 'Ward 3' },
      });
      const res = mockResponse();

      await createIncident(req, res);

      expect(prismaMock.incident.count).toHaveBeenCalledWith({ where: { hospitalId: 'hosp-1' } });
      expect(prismaMock.incident.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ code: 'INC-0100', progress: 0, hospitalId: 'hosp-1' }) })
      );
      expect(mockRoomEmit).toHaveBeenCalledWith('h-hosp-1:clinical-staff', 'incident-created', expect.objectContaining({ id: 'inc-1' }));
      expect(prismaMock.notification.createManyAndReturn).toHaveBeenCalledWith({
        data: [expect.objectContaining({ type: 'INCIDENT', userId: 'u2', title: 'New Incident Reported' })],
      });
      expect(mockRoomEmit).toHaveBeenCalledWith('user-u2', 'new-notification', expect.objectContaining({ id: 'n1' }));
      // clinical staff + admins, never the actor
      const where = (prismaMock.user.findMany.mock.calls[0][0] as any).where;
      expect(JSON.stringify(where)).toContain('"not":"u1"');
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('updateIncident', () => {
    it('يضيف resolvedAt تلقائياً لو الحالة صارت RESOLVED وما تم تمريره', async () => {
      prismaMock.incident.findFirst.mockResolvedValue({ severity: 'LOW', status: 'ACTIVE' } as any);
      prismaMock.incident.update.mockResolvedValue({ id: 'inc-1', status: 'RESOLVED' } as any);

      const req = mockRequest({ params: { id: 'inc-1' }, body: { status: 'RESOLVED' } });
      const res = mockResponse();

      await updateIncident(req, res);

      const dataArg = (prismaMock.incident.update.mock.calls[0][0] as any).data;
      expect(dataArg.resolvedAt).toBeInstanceOf(Date);
    });

    it('ينشئ إشعار "Incident Escalated" لما الخطورة ترتفع', async () => {
      prismaMock.incident.findFirst.mockResolvedValue({ severity: 'LOW', status: 'ACTIVE' } as any);
      prismaMock.incident.update.mockResolvedValue({ id: 'inc-1', code: 'INC-1', severity: 'CRITICAL', status: 'ACTIVE' } as any);
      const req = mockRequest({
        user: { id: 'u1', email: 'a@a.com', role: 'ADMIN', hospitalId: 'hosp-1' },
        params: { id: 'inc-1' },
        body: { severity: 'CRITICAL' },
      });

      await updateIncident(req, mockResponse());

      expect(prismaMock.notification.createManyAndReturn).toHaveBeenCalledWith({
        data: [expect.objectContaining({ title: 'Incident Escalated' })],
      });
    });

    it('ما بينشئ إشعار لو الخطورة انخفضت', async () => {
      prismaMock.incident.findFirst.mockResolvedValue({ severity: 'CRITICAL', status: 'ACTIVE' } as any);
      prismaMock.incident.update.mockResolvedValue({ id: 'inc-1', code: 'INC-1', severity: 'LOW', status: 'ACTIVE' } as any);
      const req = mockRequest({ params: { id: 'inc-1' }, body: { severity: 'LOW' } });

      await updateIncident(req, mockResponse());

      expect(prismaMock.notification.createManyAndReturn).not.toHaveBeenCalled();
    });

    it('ينشئ إشعار "Incident Resolved" لما التحديث العام يحل الحادث', async () => {
      prismaMock.incident.findFirst.mockResolvedValue({ severity: 'LOW', status: 'ACTIVE' } as any);
      prismaMock.incident.update.mockResolvedValue({ id: 'inc-1', code: 'INC-1', severity: 'LOW', status: 'RESOLVED' } as any);
      const req = mockRequest({ params: { id: 'inc-1' }, body: { status: 'RESOLVED' } });

      await updateIncident(req, mockResponse());

      expect(prismaMock.notification.createManyAndReturn).toHaveBeenCalledWith({
        data: [expect.objectContaining({ title: 'Incident Resolved' })],
      });
    });

    it('يحول الحقول الفاضية (patientId, actionTaken) إلى null', async () => {
      prismaMock.incident.findFirst.mockResolvedValue({ severity: 'LOW', status: 'ACTIVE' } as any);
      prismaMock.incident.update.mockResolvedValue({ id: 'inc-1' } as any);

      const req = mockRequest({
        params: { id: 'inc-1' },
        body: { patientId: '', actionTaken: '' },
      });
      const res = mockResponse();

      await updateIncident(req, res);

      const dataArg = (prismaMock.incident.update.mock.calls[0][0] as any).data;
      expect(dataArg.patientId).toBeNull();
      expect(dataArg.actionTaken).toBeNull();
    });
  });

  describe('updateIncidentStatus', () => {
    it('ينشئ إشعار "Incident Resolved" لما الحالة تصير RESOLVED', async () => {
      prismaMock.incident.findFirst.mockResolvedValue({ id: 'inc-1' } as any);
      prismaMock.incident.update.mockResolvedValue({ id: 'inc-1', code: 'INC-0001' } as any);

      const req = mockRequest({
        user: { id: 'u1', email: 'a@a.com', role: 'ADMIN', hospitalId: 'hosp-1' },
        params: { id: 'inc-1' },
        body: { status: 'RESOLVED' },
      });
      const res = mockResponse();

      await updateIncidentStatus(req, res);

      expect(prismaMock.notification.createManyAndReturn).toHaveBeenCalledWith({
        data: [expect.objectContaining({ title: 'Incident Resolved' })],
      });
    });

    it('ما بينشئ إشعار لو الحالة مش RESOLVED', async () => {
      prismaMock.incident.findFirst.mockResolvedValue({ id: 'inc-1' } as any);
      prismaMock.incident.update.mockResolvedValue({ id: 'inc-1', code: 'INC-0001' } as any);

      const req = mockRequest({
        user: { id: 'u1', email: 'a@a.com', role: 'ADMIN', hospitalId: 'hosp-1' },
        params: { id: 'inc-1' },
        body: { status: 'IN_PROGRESS', progress: 50 },
      });
      const res = mockResponse();

      await updateIncidentStatus(req, res);

      expect(prismaMock.notification.createManyAndReturn).not.toHaveBeenCalled();
      const dataArg = (prismaMock.incident.update.mock.calls[0][0] as any).data;
      expect(dataArg.progress).toBe(50);
    });
  });

  describe('incidents of another hospital', () => {
    it('update / status / delete return 404 and change nothing', async () => {
      prismaMock.incident.findFirst.mockResolvedValue(null);

      const r1 = mockResponse();
      await updateIncident(mockRequest({ params: { id: 'foreign' }, body: { severity: 'LOW' } }), r1);
      const r2 = mockResponse();
      await updateIncidentStatus(mockRequest({ params: { id: 'foreign' }, body: { status: 'RESOLVED' } }), r2);
      const r3 = mockResponse();
      await deleteIncident(mockRequest({ params: { id: 'foreign' } }), r3);

      [r1, r2, r3].forEach((r) => expect(r.status).toHaveBeenCalledWith(404));
      expect(prismaMock.incident.update).not.toHaveBeenCalled();
      expect(prismaMock.incident.delete).not.toHaveBeenCalled();
    });

    it('createIncident takes the hospital from the caller, not the body', async () => {
      prismaMock.incident.count.mockResolvedValue(0);
      prismaMock.incident.create.mockResolvedValue({ id: 'i', code: 'INC-0091', title: 't' } as any);

      await createIncident(
        mockRequest({ body: { title: 't', type: 'FIRE', severity: 'LOW', location: 'l', hospitalId: 'other-hospital' } }),
        mockResponse()
      );

      expect((prismaMock.incident.create.mock.calls[0][0] as any).data.hospitalId).toBe('hosp-1');
    });
  });

  describe('deleteIncident', () => {
    it('يحذف الحادث ويبث incident-deleted', async () => {
      prismaMock.incident.findFirst.mockResolvedValue({ id: 'inc-1' } as any);
      prismaMock.incident.delete.mockResolvedValue({} as any);
      const req = mockRequest({ params: { id: 'inc-1' } });
      const res = mockResponse();

      await deleteIncident(req, res);

      expect(mockRoomEmit).toHaveBeenCalledWith('h-hosp-1:clinical-staff', 'incident-deleted', { id: 'inc-1' });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
