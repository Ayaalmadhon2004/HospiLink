// backend/tests/mocks/prisma.ts
//
// موك موحّد لـ Prisma Client. أي test بيحتاج يتحكم بالداتابيز لازم يعمل import
// لهاد الملف *قبل* ما يعمل import للـ controller/middleware يلي بدو يتيسته.
//
// النمط هاد هو النمط الرسمي الموصى فيه من Prisma نفسها لعمل Unit Testing:
// https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing

import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

jest.mock('../../src/config/db', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

import prisma from '../../src/config/db';

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
});
