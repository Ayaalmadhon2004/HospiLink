// tests-int/helpers/db.ts
import prisma from '../../src/config/db';

/**
 * Empties every table (but not the migration history) between tests. TRUNCATE does not fire the row-level
 * "no hard delete" triggers, so the soft-delete / immutability guards stay installed and testable.
 */
export const resetDb = async (): Promise<void> => {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
};

export const closeDb = async (): Promise<void> => {
  await prisma.$disconnect();
};

/** Postgres error code of a Prisma/pg failure (e.g. '23P01' exclusion, '23514' check, '23505' unique, '23001' restrict). */
export const pgCode = (err: unknown): string | undefined => {
  const e = err as { code?: string; meta?: { code?: string; driverAdapterError?: { cause?: { originalCode?: string } } }; cause?: { originalCode?: string; code?: string } };
  return e?.meta?.driverAdapterError?.cause?.originalCode ?? e?.meta?.code ?? e?.cause?.originalCode ?? e?.cause?.code ?? e?.code;
};

/** The database's own error text (Prisma hides it behind a generic "foreign key violated" for restrict_violation). */
export const pgMessage = (err: unknown): string => {
  const e = err as { meta?: { driverAdapterError?: { cause?: { originalMessage?: string } } }; message?: string };
  return e?.meta?.driverAdapterError?.cause?.originalMessage ?? e?.message ?? '';
};

/** Runs `fn` and returns the error it throws (fails the test when it does not throw). */
export const rejection = async (fn: () => Promise<unknown>): Promise<Error> => {
  try {
    await fn();
  } catch (err) {
    return err as Error;
  }
  throw new Error('Expected the operation to be rejected, but it succeeded');
};

export { prisma };
