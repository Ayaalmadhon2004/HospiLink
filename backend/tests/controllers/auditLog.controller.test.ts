import { prismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse } from '../mocks/http';
import { listAuditLogs, listAuditActions } from '../../src/controllers/auditLog.controller';

describe('auditLog.controller', () => {
  it('always scopes by the caller\'s hospital and paginates newest-first (default 50)', async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([{ id: 'a1' }] as any);
    prismaMock.auditLog.count.mockResolvedValue(120);
    const res = mockResponse();
    await listAuditLogs(mockRequest({ query: { hospitalId: 'evil' } as any }), res);
    const arg = prismaMock.auditLog.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ hospitalId: 'hosp-1' });
    expect(arg.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(arg.take).toBe(50);
    expect(arg.select.user.select).not.toHaveProperty('password');
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.pagination).toMatchObject({ totalCount: 120, totalPages: 3, hasNextPage: true });
  });

  it('applies action/user/entity filters and a half-open date range', async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([]);
    prismaMock.auditLog.count.mockResolvedValue(0);
    await listAuditLogs(
      mockRequest({ query: { action: 'DELETE_WARD', userId: 'u2', entityId: 'w1', from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z', page: '2', limit: '10' } as any }),
      mockResponse()
    );
    const arg = prismaMock.auditLog.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({
      hospitalId: 'hosp-1', action: 'DELETE_WARD', userId: 'u2', entityId: 'w1',
      createdAt: { gte: new Date('2026-01-01T00:00:00Z'), lt: new Date('2026-02-01T00:00:00Z') },
    });
    expect(arg).toMatchObject({ skip: 10, take: 10 });
    expect(prismaMock.auditLog.count).toHaveBeenCalledWith({ where: arg.where });
  });

  it('500 on a database error', async () => {
    prismaMock.auditLog.findMany.mockRejectedValue(new Error('boom'));
    const res = mockResponse();
    await listAuditLogs(mockRequest(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('listAuditActions returns distinct names of the hospital only', async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([{ action: 'A' }, { action: 'B' }] as any);
    const res = mockResponse();
    await listAuditActions(mockRequest(), res);
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { hospitalId: 'hosp-1' }, distinct: ['action'] }));
    expect((res.json as jest.Mock).mock.calls[0][0].data).toEqual(['A', 'B']);
  });
});
