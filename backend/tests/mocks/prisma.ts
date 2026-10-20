// backend/tests/mocks/prisma.ts
//
// موك موحّد لـ Prisma Client. أي test بيحتاج يتحكم بالداتابيز لازم يعمل import
// لهاد الملف *قبل* ما يعمل import للـ controller/middleware يلي بدو يتيسته.
//
// النمط هاد هو النمط الرسمي الموصى فيه من Prisma نفسها لعمل Unit Testing:
// https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing

import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'jest-mock-extended';

jest.mock('../../src/config/db', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

import prisma from '../../src/config/db';

// ملاحظة: DeepMockProxy<PrismaClient> بيعمل TS2615 (أنواع دائرية) مع Prisma 7،
// فبنستخدم نوع مبسّط: كل model/method هو jest.Mock.
type PrismaMock = Record<string, any> & Record<string, Record<string, jest.Mock>>;

export const prismaMock = prisma as unknown as PrismaMock;

beforeEach(() => {
  mockReset(prismaMock);
});
