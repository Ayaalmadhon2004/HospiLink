import { prismaMock } from '../mocks/prisma';
import '../mocks/io';
import { mockRequest, mockResponse } from '../mocks/http';
import { createDeviceKey, revokeDeviceKey, ingestVitals } from '../../src/controllers/devices.controller';
import { deviceAuth, hashDeviceKey } from '../../src/middlewares/deviceAuth.middleware';

describe('device keys + ingest endpoint', () => {
  it('createDeviceKey returns the plaintext key once and stores only its hash', async () => {
    prismaMock.deviceKey.create.mockResolvedValue({ id: 'k1', name: 'ICU monitor' } as never);
    const res = mockResponse();
    await createDeviceKey(mockRequest({ body: { name: 'ICU monitor' } }), res);
    const stored = prismaMock.deviceKey.create.mock.calls[0][0].data;
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(res.status).toHaveBeenCalledWith(201);
    expect(body.data.key).toMatch(/^hl_/);
    expect(stored.keyHash).toBe(hashDeviceKey(body.data.key));
    expect(stored.hospitalId).toBe('hosp-1');
    expect(JSON.stringify(stored)).not.toContain(body.data.key);
  });

  it('revokeDeviceKey is 404 for another hospital\'s key', async () => {
    prismaMock.deviceKey.updateMany.mockResolvedValue({ count: 0 });
    const res = mockResponse();
    await revokeDeviceKey(mockRequest({ params: { id: 'k9' } }), res);
    expect(prismaMock.deviceKey.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'k9', hospitalId: 'hosp-1', revokedAt: null } }));
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deviceAuth: 401 without a key or with a revoked/unknown key; passes and sets the device otherwise', async () => {
    const next = jest.fn();
    let res = mockResponse();
    await deviceAuth(mockRequest({ headers: {} }), res, next);
    expect(res.status).toHaveBeenCalledWith(401);

    prismaMock.deviceKey.findFirst.mockResolvedValueOnce(null);
    res = mockResponse();
    await deviceAuth(mockRequest({ headers: { 'x-device-key': 'nope' } }), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();

    prismaMock.deviceKey.findFirst.mockResolvedValueOnce({ id: 'k1', hospitalId: 'h1' } as never);
    prismaMock.deviceKey.update.mockResolvedValue({} as never);
    res = mockResponse();
    res.locals = {};
    await deviceAuth(mockRequest({ headers: { 'x-device-key': 'good' } }), res, next);
    expect(prismaMock.deviceKey.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { keyHash: hashDeviceKey('good'), revokedAt: null } }));
    expect(next).toHaveBeenCalled();
    expect(res.locals.device).toEqual({ id: 'k1', hospitalId: 'h1' });
  });

  it('ingestVitals: 400 on a malformed HL7 body, 201 when stored, 422 when nothing is accepted', async () => {
    let res = mockResponse();
    res.locals = { device: { id: 'k1', hospitalId: 'h1' } };
    await ingestVitals(mockRequest({ params: { protocol: 'hl7' }, body: 'garbage' }), res);
    expect(res.status).toHaveBeenCalledWith(400);

    prismaMock.vitalThresholds.findMany.mockResolvedValue([]);
    prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1', department: 'ICU', hospitalId: 'h1', doctor: null } as never);
    prismaMock.patientVitals.create.mockResolvedValue({ id: 'v1' } as never);
    res = mockResponse();
    res.locals = { device: { id: 'k1', hospitalId: 'h1' } };
    await ingestVitals(mockRequest({ params: { protocol: 'json' }, body: { patientCode: 'P-1', heartRate: 80 } }), res);
    expect(res.status).toHaveBeenCalledWith(201);

    prismaMock.patient.findFirst.mockResolvedValue(null);
    res = mockResponse();
    res.locals = { device: { id: 'k1', hospitalId: 'h1' } };
    await ingestVitals(mockRequest({ params: { protocol: 'json' }, body: { patientCode: 'X', heartRate: 80 } }), res);
    expect(res.status).toHaveBeenCalledWith(422);
  });
});
