import { prismaMock } from '../mocks/prisma';
import { mockRoomEmit } from '../mocks/io';
import { mockRequest, mockResponse } from '../mocks/http';
import {
  getAllUnits,
  getActiveUnits,
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
        expect.objectContaining({ orderBy: { unitCode: 'asc' } })
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
        expect.objectContaining({ where: { status: { not: 'OFF_DUTY' } } })
      );
    });
  });

  describe('updateUnitStatus', () => {
    it('يحدث حالة الوحدة ويبث لغرفة dispatch-room وغرفة القسم', async () => {
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
        'dispatch-room',
        'unit-status-update',
        expect.objectContaining({ unitId: 'u1', status: 'EN_ROUTE' })
      );
      expect(mockRoomEmit).toHaveBeenCalledWith(
        'department-ER',
        'unit-status-update',
        expect.objectContaining({ unitCode: 'AMB-01' })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('يحول location كائن لـ JSON string قبل التحديث', async () => {
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

      expect(mockRoomEmit).toHaveBeenCalledWith(
        'dispatch-room',
        'new-call',
        expect.objectContaining({ callId: 'call-1' })
      );
      expect(mockRoomEmit).not.toHaveBeenCalledWith(
        'dispatch-room',
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
        'dispatch-room',
        'critical-alert',
        expect.objectContaining({ callId: 'call-2' })
      );
    });
  });

  describe('assignUnitToCall', () => {
    it('يعين وحدة للنداء ضمن transaction ويبث الحدثين المطلوبين', async () => {
      const updatedCall = { id: 'call-1', type: 'ACCIDENT', location: 'Main St' };
      const updatedUnit = { id: 'unit-1', status: 'EN_ROUTE' };

      (prismaMock.$transaction as unknown as jest.Mock).mockResolvedValue([
        updatedCall,
        updatedUnit,
      ]);

      const req = mockRequest({ params: { id: 'call-1' }, body: { unitId: 'unit-1' } });
      const res = mockResponse();

      await assignUnitToCall(req, res);

      expect(mockRoomEmit).toHaveBeenCalledWith(
        'dispatch-room',
        'call-assigned',
        expect.objectContaining({ callId: 'call-1', unitId: 'unit-1' })
      );
      expect(mockRoomEmit).toHaveBeenCalledWith(
        'unit-unit-1',
        'unit-assigned',
        expect.objectContaining({ callId: 'call-1' })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});