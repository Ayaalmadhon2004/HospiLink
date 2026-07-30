// backend/tests/mocks/http.ts
//
// هيلبرز لبناء req/res وهميين (fake) بدل ما نشغل سيرفر Express حقيقي.
// هيك التيست بيصير أسرع وبيركز بس على منطق الـ controller.

import { Request, Response } from 'express';

export function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    user: undefined,
    ...overrides,
  } as unknown as Request;
}

export function mockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res as Response;
}

export const mockNext = () => jest.fn();
