import { prismaMock } from '../mocks/prisma';
import { mockRoomEmit } from '../mocks/io';
import { mockRequest, mockResponse } from '../mocks/http';
import {
  getAllUnits,
  getActiveUnits,
  getCalls,
  updateUnitStatus,
  createCall,
  assignUnitToCall,
} from '../../src/controllers/dispatch.controller';

describe('dispatch.controller', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  describe('getAllUnits', () => {
    it('يرجع كل وحدات الديسباتش مرتبة حسب unitCode', async () => {
      prismaMock.dispatchUnit.findMany.mockResolvedValue([{ id: 'u1' }] as any);
      const req = mockRequest();
      const res = mockResponse();

      await getAllUnits(req, res);

      expect(prismaMock.dispatchUnit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { hospitalId: 'hosp-1' }, orderBy: { unitCode: 'asc' } })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getActiveUnits', () => {
    it('يستثني الوحدات OFF_DUTY فقط', async () => {
      prismaMock.dispatchUnit.findMany.mockResolvedValue([]);
      const req = mockRequest();
      const res = mockResponse();

      await getActiveUnits(req, res);

      expect(prismaMock.dispatchUnit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { hospitalId: 'hosp-1', status: { not: 'OFF_DUTY' } } })
      );
    });
  });

  describe('getCalls', () => {
    it('defaults to PENDING calls, most urgent first', async () => {
      prismaMock.dispatchCall.findMany.mockResolvedValue([{ id: 'c1' }] as any);
      const res = mockResponse();

      await getCalls(mockRequest({ query: {} }), res);

      expect(prismaMock.dispatchCall.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'PENDING', hospitalId: 'hosp-1' }, orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }] })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('honours the status filter', async () => {
      prismaMock.dispatchCall.findMany.mockResolvedValue([]);
      await getCalls(mockRequest({ query: { status: 'ASSIGNED' } }), mockResponse());
      expect(prismaMock.dispatchCall.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'ASSIGNED', hospitalId: 'hosp-1' } }));
    });

    it('returns 500 with a generic message on failure', async () => {
      prismaMock.dispatchCall.findMany.mockRejectedValue(new Error('db secret'));
      const res = mockResponse();
      await getCalls(mockRequest({ query: {} }), res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Failed to fetch calls' });
    });
  });

  describe('updateUnitStatus', () => {
    it('يحدث حالة الوحدة ويبث لغرفة dispatch-room وغرفة القسم', async () => {
      prismaMock.dispatchUnit.findFirst.mockResolvedValue({ id: 'u1' } as any);
      prismaMock.dispatchUnit.update.mockResolvedValue({
        id: 'u1',
        department: 'ER',
        unitCode: 'AMB-01',
      } as any);

      const req = mockRequest({
        params: { id: 'u1' },
        body: { status: 'EN_ROUTE', location: { lat: 1, lng: 2 } },
      });
      const res = mockResponse();

      await updateUnitStatus(req, res);

      expect(mockRoomEmit).toHaveBeenCalledWith(
        'h-hosp-1:dispatch-room',
        'unit-status-update',
        expect.objectContaining({ unitId: 'u1', status: 'EN_ROUTE' })
      );
      expect(mockRoomEmit).toHaveBeenCalledWith(
        'h-hosp-1:department-ER',
        'unit-status-update',
        expect.objectContaining({ unitCode: 'AMB-01' })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('يرجع 404 لوحدة أو نداء من مستشفى ثاني ولا يحدث شي', async () => {
      prismaMock.dispatchUnit.findFirst.mockResolvedValue(null);
      const res = mockResponse();
      await updateUnitStatus(mockRequest({ params: { id: 'foreign' }, body: { status: 'EN_ROUTE' } }), res);
      expect(res.status).toHaveBeenCalledWith(404);

      prismaMock.dispatchUnit.findFirst.mockResolvedValue({ id: 'u1' } as any);
      prismaMock.dispatchCall.findFirst.mockResolvedValue(null);
      const res2 = mockResponse();
      await updateUnitStatus(mockRequest({ params: { id: 'u1' }, body: { status: 'EN_ROUTE', callId: 'foreign-call' } }), res2);
      expect(res2.status).toHaveBeenCalledWith(404);

      expect(prismaMock.dispatchUnit.update).not.toHaveBeenCalled();
    });

    it('يحول location كائن لـ JSON string قبل التحديث', async () => {
      prismaMock.dispatchUnit.findFirst.mockResolvedValue({ id: 'u1' } as any);
      prismaMock.dispatchUnit.update.mockResolvedValue({ id: 'u1', department: 'ER' } as any);

      const req = mockRequest({
        params: { id: 'u1' },
        body: { status: 'ON_SCENE', location: { lat: 31.9, lng: 35.3 } },
      });
      const res = mockResponse();

      await updateUnitStatus(req, res);

      const dataArg = (prismaMock.dispatchUnit.update.mock.calls[0][0] as any).data;
      expect(dataArg.location).toBe(JSON.stringify({ lat: 31.9, lng: 35.3 }));
    });
  });

  describe('createCall', () => {
    it('ينشئ نداء عادي بدون تنبيه حرج لو الأولوية مش CRITICAL', async () => {
      prismaMock.dispatchCall.create.mockResolvedValue({ id: 'call-1' } as any);

      const req = mockRequest({
        body: { type: 'ACCIDENT', location: 'Main St', priority: 'MEDIUM' },
      });
      const res = mockResponse();

      await createCall(req, res);

      expect(prismaMock.dispatchCall.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ hospitalId: 'hosp-1', status: 'PENDING' }),
      });
      expect(mockRoomEmit).toHaveBeenCalledWith(
        'h-hosp-1:dispatch-room',
        'new-call',
        expect.objectContaining({ callId: 'call-1' })
      );
      expect(mockRoomEmit).not.toHaveBeenCalledWith(
        'h-hosp-1:dispatch-room',
        'critical-alert',
        expect.anything()
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('يبث تنبيه critical-alert إضافي لو الأولوية CRITICAL', async () => {
      prismaMock.dispatchCall.create.mockResolvedValue({ id: 'call-2' } as any);

      const req = mockRequest({
        body: { type: 'CARDIAC_ARREST', location: 'ICU', priority: 'CRITICAL' },
      });
      const res = mockResponse();

      await createCall(req, res);

      expect(mockRoomEmit).toHaveBeenCalledWith(
        'h-hosp-1:dispatch-room',
        'critical-alert',
        expect.objectContaining({ callId: 'call-2' })
      );
    });
  });

  describe('assignUnitToCall', () => {
    const runTx = () =>
      (prismaMock.$transaction as unknown as jest.Mock).mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock));
    const req = () => mockRequest({ params: { id: 'call-1' }, body: { unitId: 'unit-1' } });

    it('assigns a pending call to an available unit and broadcasts', async () => {
      runTx();
      prismaMock.dispatchCall.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.dispatchUnit.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.dispatchCall.findUniqueOrThrow.mockResolvedValue({ id: 'call-1', type: 'ACCIDENT', location: 'Main St' });
      prismaMock.dispatchUnit.findUniqueOrThrow.mockResolvedValue({ id: 'unit-1', unitCode: 'AMB-1', status: 'EN_ROUTE' });
      const res = mockResponse();

      await assignUnitToCall(req(), res);

      expect(prismaMock.dispatchCall.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'call-1', hospitalId: 'hosp-1', status: 'PENDING', assignedUnitId: null } })
      );
      expect(prismaMock.dispatchUnit.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'unit-1', hospitalId: 'hosp-1', status: 'AVAILABLE', currentCallId: null } })
      );
      expect(mockRoomEmit).toHaveBeenCalledWith('h-hosp-1:dispatch-room', 'call-assigned', expect.objectContaining({ callId: 'call-1', unitId: 'unit-1' }));
      expect(mockRoomEmit).toHaveBeenCalledWith('h-hosp-1:unit-unit-1', 'unit-assigned', expect.objectContaining({ callId: 'call-1' }));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 409 when the call was already assigned', async () => {
      runTx();
      prismaMock.dispatchCall.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.dispatchCall.findFirst.mockResolvedValue({ id: 'call-1' });
      const res = mockResponse();

      await assignUnitToCall(req(), res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(prismaMock.dispatchUnit.updateMany).not.toHaveBeenCalled();
      expect(mockRoomEmit).not.toHaveBeenCalled();
    });

    it('returns 404 (not 409) for a call of another hospital: the scoped claim finds nothing', async () => {
      runTx();
      prismaMock.dispatchCall.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.dispatchCall.findFirst.mockResolvedValue(null);
      const res = mockResponse();
      await assignUnitToCall(req(), res);
      expect(prismaMock.dispatchCall.findFirst).toHaveBeenCalledWith({ where: { id: 'call-1', hospitalId: 'hosp-1' }, select: { id: true } });
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 404 when the call does not exist', async () => {
      runTx();
      prismaMock.dispatchCall.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.dispatchCall.findFirst.mockResolvedValue(null);
      const res = mockResponse();
      await assignUnitToCall(req(), res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 409 when the unit is not available', async () => {
      runTx();
      prismaMock.dispatchCall.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.dispatchUnit.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.dispatchUnit.findFirst.mockResolvedValue({ id: 'unit-1' });
      const res = mockResponse();
      await assignUnitToCall(req(), res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(mockRoomEmit).not.toHaveBeenCalled();
    });

    it('returns 404 when the unit does not exist', async () => {
      runTx();
      prismaMock.dispatchCall.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.dispatchUnit.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.dispatchUnit.findFirst.mockResolvedValue(null);
      const res = mockResponse();
      await assignUnitToCall(req(), res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
