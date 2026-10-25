// backend/src/utils/dbErrors.ts

/**
 * True when a transaction lost a serializable / deadlock race and can simply be retried by the caller.
 * Prisma reports it as P2034, but with the pg driver adapter the error that reaches us is a bare
 * DriverAdapterError ("TransactionWriteConflict") whose cause carries the PostgreSQL code (40001 / 40P01):
 * both shapes are recognised (found by tests-int/concurrency.int.test.ts).
 */
export const isSerializationFailure = (error: unknown): boolean => {
  const e = error as { code?: unknown; message?: unknown; cause?: { originalCode?: unknown }; meta?: { driverAdapterError?: { cause?: { originalCode?: unknown } } } } | null;
  if (!e || typeof e !== 'object') return false;
  const pg = e.cause?.originalCode ?? e.meta?.driverAdapterError?.cause?.originalCode;
  return e.code === 'P2034' || pg === '40001' || pg === '40P01' || e.message === 'TransactionWriteConflict';
};
