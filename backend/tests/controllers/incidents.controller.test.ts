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
    prismaMock.notification.create.mockResolvedValue({} as any);
  });
  afterEach(() => jest.restoreAllMocks());

  describe('getIncidents', () => {
    it('يبني فلتر where فقط من الحقول المرسلة وغير الفاضية', async () => {
      prismaMock.incident.findMany.mockResolvedValue([]);
      const req = mockRequest({ query: { status: 'ACTIVE', severity: '', type: 'FIRE' } });
      const res = mockResponse();

      await getIncidents(req, res);

      const whereArg = (prismaMock.incident.findMany.mock.calls[0][0] as any).where;
      expect(whereArg).toEqual({ status: 'ACTIVE', type: 'FIRE' });
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

      const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(jsonArg.data.critical).toHaveLength(2);
      expect(jsonArg.data.elevated).toHaveLength(1);
      expect(jsonArg.data.moderate).toHaveLength(1);
      expect(jsonArg.data.total).toBe(4);
    });
  });

  describe('getIncidentById', () => {
    it('يرجع 404 لو الحادث مش موجود', async () => {
      prismaMock.incident.findUnique.mockResolvedValue(null);
      const req = mockRequest({ params: { id: 'nope' } });
      const res = mockResponse();

      await getIncidentById(req, res);

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
        user: { id: 'u1', email: 'a@a.com', role: 'ADMIN' },
        body: { title: 'Fire in Ward 3', type: 'FIRE', severity: 'CRITICAL', location: 'Ward 3' },
      });
      const res = mockResponse();

      await createIncident(req, res);

      expect(prismaMock.incident.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ code: 'INC-0100', progress: 0 }) })
      );
      expect(mockRoomEmit).toHaveBeenCalledWith('clinical-staff', 'incident-created', expect.objectContaining({ id: 'inc-1' }));
      expect(prismaMock.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'INCIDENT', userId: 'u1' }),
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('updateIncident', () => {
    it('يضيف resolvedAt تلقائياً لو الحالة صارت RESOLVED وما تم تمريره', async () => {
      prismaMock.incident.update.mockResolvedValue({ id: 'inc-1', status: 'RESOLVED' } as any);

      const req = mockRequest({ params: { id: 'inc-1' }, body: { status: 'RESOLVED' } });
      const res = mockResponse();

      await updateIncident(req, res);

      const dataArg = (prismaMock.incident.update.mock.calls[0][0] as any).data;
      expect(dataArg.resolvedAt).toBeInstanceOf(Date);
    });

    it('يحول الحقول الفاضية (patientId, actionTaken) إلى null', async () => {
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
      prismaMock.incident.update.mockResolvedValue({ id: 'inc-1', code: 'INC-0001' } as any);

      const req = mockRequest({
        user: { id: 'u1', email: 'a@a.com', role: 'ADMIN' },
        params: { id: 'inc-1' },
        body: { status: 'RESOLVED' },
      });
      const res = mockResponse();

      await updateIncidentStatus(req, res);

      expect(prismaMock.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ title: 'Incident Resolved' }) })
      );
    });

    it('ما بينشئ إشعار لو الحالة مش RESOLVED', async () => {
      prismaMock.incident.update.mockResolvedValue({ id: 'inc-1', code: 'INC-0001' } as any);

      const req = mockRequest({
        user: { id: 'u1', email: 'a@a.com', role: 'ADMIN' },
        params: { id: 'inc-1' },
        body: { status: 'IN_PROGRESS', progress: 50 },
      });
      const res = mockResponse();

      await updateIncidentStatus(req, res);

      expect(prismaMock.notification.create).not.toHaveBeenCalled();
      const dataArg = (prismaMock.incident.update.mock.calls[0][0] as any).data;
      expect(dataArg.progress).toBe(50);
    });
  });

  describe('deleteIncident', () => {
    it('يحذف الحادث ويبث incident-deleted', async () => {
      prismaMock.incident.delete.mockResolvedValue({} as any);
      const req = mockRequest({ params: { id: 'inc-1' } });
      const res = mockResponse();

      await deleteIncident(req, res);

      expect(mockRoomEmit).toHaveBeenCalledWith('clinical-staff', 'incident-deleted', { id: 'inc-1' });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
