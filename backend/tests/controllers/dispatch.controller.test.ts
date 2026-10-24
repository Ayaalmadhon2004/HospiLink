import { prismaMock } from '../mocks/prisma';
import { mockRoomEmit } from '../mocks/io';
import { mockRequest, mockResponse } from '../mocks/http';
import {
  getAllUnits,
  getActiveUnits,
  getCalls,
  updateUnitStatus,
  createUnit,
  updateUnit,
  deleteUnit,
  createCall,
  assignUnitToCall,
  completeCall,
  cancelCall,
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
    const asTx = () => (prismaMock.$transaction as unknown as jest.Mock).mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock));
    const unitRow = (over = {}) => ({ id: 'u1', department: 'ER', unitCode: 'AMB-01', currentCallId: null, ...over });

    it('يحدث حالة الوحدة ويبث لغرفة dispatch-room وغرفة القسم', async () => {
      asTx();
      prismaMock.dispatchUnit.updateMany.mockResolvedValue({ count: 1 } as any);
      prismaMock.dispatchUnit.findUniqueOrThrow.mockResolvedValue(unitRowAny());
      const res = mockResponse();

      await updateUnitStatus(mockRequest({ params: { id: 'u1' }, body: { status: 'EN_ROUTE', location: { lat: 1, lng: 2 } } }), res);

      expect(mockRoomEmit).toHaveBeenCalledWith('h-hosp-1:dispatch-room', 'unit-status-update', expect.objectContaining({ unitId: 'u1', status: 'EN_ROUTE' }));
      expect(mockRoomEmit).toHaveBeenCalledWith('h-hosp-1:department-ER', 'unit-status-update', expect.objectContaining({ unitCode: 'AMB-01' }));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('الاستعلام مقيّد بمستشفى المستخدم، و 404 لوحدة من مستشفى ثاني', async () => {
      asTx();
      prismaMock.dispatchUnit.updateMany.mockResolvedValue({ count: 0 } as any);
      prismaMock.dispatchUnit.findFirst.mockResolvedValue(null);
      const res = mockResponse();

      await updateUnitStatus(mockRequest({ params: { id: 'foreign' }, body: { status: 'EN_ROUTE' } }), res);

      expect(prismaMock.dispatchUnit.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign', hospitalId: 'hosp-1' } }));
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it.each(['AVAILABLE', 'OFF_DUTY'])('وحدة على نداء فعّال ما بتصير %s: 409', async (status) => {
      asTx();
      prismaMock.dispatchUnit.updateMany.mockResolvedValue({ count: 0 } as any);
      prismaMock.dispatchUnit.findFirst.mockResolvedValue({ id: 'u1' } as any);
      const res = mockResponse();

      await updateUnitStatus(mockRequest({ params: { id: 'u1' }, body: { status } }), res);

      // the freeing statuses only match a unit WITHOUT a call
      expect(prismaMock.dispatchUnit.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1', hospitalId: 'hosp-1', currentCallId: null } })
      );
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('الـ callId من الـ body ما بيغيّر ربط الوحدة بالنداء أبداً', async () => {
      asTx();
      prismaMock.dispatchUnit.updateMany.mockResolvedValue({ count: 1 } as any);
      prismaMock.dispatchUnit.findUniqueOrThrow.mockResolvedValue(unitRowAny());

      await updateUnitStatus(mockRequest({ params: { id: 'u1' }, body: { status: 'EN_ROUTE', callId: 'other-call' } }), mockResponse());

      const data = (prismaMock.dispatchUnit.updateMany.mock.calls[0][0] as any).data;
      expect(data).not.toHaveProperty('currentCallId');
    });

    it('EN_ROUTE / ON_SCENE بتنعكس على النداء، و TRANSPORTING لا', async () => {
      asTx();
      prismaMock.dispatchUnit.updateMany.mockResolvedValue({ count: 1 } as any);
      prismaMock.dispatchUnit.findUniqueOrThrow.mockResolvedValue(unitRowAny({ currentCallId: 'c1' }));
      prismaMock.dispatchCall.updateMany.mockResolvedValue({ count: 1 } as any);

      await updateUnitStatus(mockRequest({ params: { id: 'u1' }, body: { status: 'ON_SCENE' } }), mockResponse());
      expect(prismaMock.dispatchCall.updateMany).toHaveBeenCalledWith({
        where: { id: 'c1', hospitalId: 'hosp-1', status: { in: ['PENDING', 'ASSIGNED', 'EN_ROUTE', 'ON_SCENE'] } },
        data: { status: 'ON_SCENE' },
      });

      prismaMock.dispatchCall.updateMany.mockClear();
      await updateUnitStatus(mockRequest({ params: { id: 'u1' }, body: { status: 'TRANSPORTING' } }), mockResponse());
      expect(prismaMock.dispatchCall.updateMany).not.toHaveBeenCalled();
    });

    it('يحول location كائن لـ JSON string قبل التحديث', async () => {
      asTx();
      prismaMock.dispatchUnit.updateMany.mockResolvedValue({ count: 1 } as any);
      prismaMock.dispatchUnit.findUniqueOrThrow.mockResolvedValue(unitRowAny());

      await updateUnitStatus(mockRequest({ params: { id: 'u1' }, body: { status: 'ON_SCENE', location: { lat: 31.9, lng: 35.3 } } }), mockResponse());

      const dataArg = (prismaMock.dispatchUnit.updateMany.mock.calls[0][0] as any).data;
      expect(dataArg.location).toBe(JSON.stringify({ lat: 31.9, lng: 35.3 }));
    });

    function unitRowAny(over = {}) {
      return unitRow(over) as any;
    }
  });

  describe('closing a call (complete / cancel)', () => {
    const asTx = () => (prismaMock.$transaction as unknown as jest.Mock).mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock));

    it.each([
      [completeCall, 'COMPLETED', 'call-completed'],
      [cancelCall, 'CANCELLED', 'call-cancelled'],
    ] as const)('closes the call and releases its unit in one transaction (%#)', async (handler, target, event) => {
      asTx();
      prismaMock.dispatchCall.updateMany.mockResolvedValue({ count: 1 } as any);
      prismaMock.dispatchCall.findUniqueOrThrow.mockResolvedValue({ id: 'c1', status: target, assignedUnitId: 'u1' } as any);
      prismaMock.dispatchUnit.updateMany.mockResolvedValue({ count: 1 } as any);
      prismaMock.dispatchUnit.findFirst.mockResolvedValue({ id: 'u1', status: 'AVAILABLE' } as any);
      const res = mockResponse();

      await handler(mockRequest({ params: { id: 'c1' } }), res);

      expect(prismaMock.dispatchCall.updateMany).toHaveBeenCalledWith({
        where: { id: 'c1', hospitalId: 'hosp-1', status: { in: ['PENDING', 'ASSIGNED', 'EN_ROUTE', 'ON_SCENE'] } },
        data: { status: target },
      });
      expect(prismaMock.dispatchUnit.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: 'u1', hospitalId: 'hosp-1', currentCallId: 'c1' },
        data: { currentCallId: null, eta: null },
      });
      // an OFF_DUTY unit keeps its status
      expect(prismaMock.dispatchUnit.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: 'u1', hospitalId: 'hosp-1', currentCallId: null, status: { not: 'OFF_DUTY' } },
        data: { status: 'AVAILABLE' },
      });
      expect(mockRoomEmit).toHaveBeenCalledWith('h-hosp-1:dispatch-room', event, expect.objectContaining({ callId: 'c1', unitId: 'u1' }));
      expect(mockRoomEmit).toHaveBeenCalledWith('h-hosp-1:dispatch-room', 'unit-status-update', expect.objectContaining({ unitId: 'u1', status: 'AVAILABLE' }));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('a call with no unit just closes', async () => {
      asTx();
      prismaMock.dispatchCall.updateMany.mockResolvedValue({ count: 1 } as any);
      prismaMock.dispatchCall.findUniqueOrThrow.mockResolvedValue({ id: 'c1', status: 'CANCELLED', assignedUnitId: null } as any);
      const res = mockResponse();

      await cancelCall(mockRequest({ params: { id: 'c1' } }), res);

      expect(prismaMock.dispatchUnit.updateMany).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('404 for a call of another hospital, 409 for one already closed', async () => {
      asTx();
      prismaMock.dispatchCall.updateMany.mockResolvedValue({ count: 0 } as any);
      prismaMock.dispatchCall.findFirst.mockResolvedValue(null);
      const res1 = mockResponse();
      await completeCall(mockRequest({ params: { id: 'foreign' } }), res1);
      expect(prismaMock.dispatchCall.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign', hospitalId: 'hosp-1' } }));
      expect(res1.status).toHaveBeenCalledWith(404);

      prismaMock.dispatchCall.findFirst.mockResolvedValue({ id: 'c1' } as any);
      const res2 = mockResponse();
      await completeCall(mockRequest({ params: { id: 'c1' } }), res2);
      expect(res2.status).toHaveBeenCalledWith(409);
      expect(prismaMock.dispatchUnit.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('unit CRUD', () => {
    it('createUnit: creates in the caller hospital, 409 on a duplicate code', async () => {
      prismaMock.dispatchUnit.create.mockResolvedValue({ id: 'u9', unitCode: 'AMB-9' } as any);
      const res = mockResponse();
      await createUnit(mockRequest({ body: { unitCode: 'AMB-9', unitType: 'AMBULANCE', hospitalId: 'other' } }), res);
      expect(prismaMock.dispatchUnit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ unitCode: 'AMB-9', unitType: 'AMBULANCE', hospitalId: 'hosp-1' }),
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockRoomEmit).toHaveBeenCalledWith('h-hosp-1:dispatch-room', 'unit-created', expect.anything());

      prismaMock.dispatchUnit.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
      const res2 = mockResponse();
      await createUnit(mockRequest({ body: { unitCode: 'AMB-9', unitType: 'AMBULANCE' } }), res2);
      expect(res2.status).toHaveBeenCalledWith(409);
    });

    it('updateUnit: 404 for another hospital, updates identity fields only, 409 on duplicate', async () => {
      prismaMock.dispatchUnit.findFirst.mockResolvedValue(null);
      const res0 = mockResponse();
      await updateUnit(mockRequest({ params: { id: 'foreign' }, body: { unitCode: 'X' } }), res0);
      expect(prismaMock.dispatchUnit.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign', hospitalId: 'hosp-1' } }));
      expect(res0.status).toHaveBeenCalledWith(404);

      prismaMock.dispatchUnit.findFirst.mockResolvedValue({ id: 'u1' } as any);
      prismaMock.dispatchUnit.update.mockResolvedValue({ id: 'u1' } as any);
      const res1 = mockResponse();
      await updateUnit(mockRequest({ params: { id: 'u1' }, body: { unitCode: 'AMB-2', crew: ['A'], status: 'OFF_DUTY', currentCallId: 'c1' } }), res1);
      expect(prismaMock.dispatchUnit.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { unitCode: 'AMB-2', unitType: undefined, department: undefined, crew: ['A'] },
      });
      expect(res1.status).toHaveBeenCalledWith(200);

      prismaMock.dispatchUnit.update.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
      const res2 = mockResponse();
      await updateUnit(mockRequest({ params: { id: 'u1' }, body: { unitCode: 'AMB-1' } }), res2);
      expect(res2.status).toHaveBeenCalledWith(409);
    });

    it('deleteUnit: only a unit without a call (409 otherwise, 404 for another hospital)', async () => {
      prismaMock.dispatchUnit.deleteMany.mockResolvedValue({ count: 1 } as any);
      const res1 = mockResponse();
      await deleteUnit(mockRequest({ params: { id: 'u1' } }), res1);
      expect(prismaMock.dispatchUnit.deleteMany).toHaveBeenCalledWith({ where: { id: 'u1', hospitalId: 'hosp-1', currentCallId: null } });
      expect(res1.status).toHaveBeenCalledWith(200);

      prismaMock.dispatchUnit.deleteMany.mockResolvedValue({ count: 0 } as any);
      prismaMock.dispatchUnit.findFirst.mockResolvedValue({ id: 'u1' } as any);
      const res2 = mockResponse();
      await deleteUnit(mockRequest({ params: { id: 'u1' } }), res2);
      expect(res2.status).toHaveBeenCalledWith(409);

      prismaMock.dispatchUnit.findFirst.mockResolvedValue(null);
      const res3 = mockResponse();
      await deleteUnit(mockRequest({ params: { id: 'foreign' } }), res3);
      expect(res3.status).toHaveBeenCalledWith(404);
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
