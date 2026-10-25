-- Scope the audit trail per hospital (needed by GET /api/audit-logs). Old rows are backfilled from the actor's hospital;
-- rows whose user was already deleted stay NULL and are not visible to any hospital.
ALTER TABLE "AuditLog" ADD COLUMN "hospitalId" TEXT;

UPDATE "AuditLog" a SET "hospitalId" = u."hospitalId" FROM "User" u WHERE a."userId" = u."id";

CREATE INDEX "AuditLog_hospitalId_createdAt_idx" ON "AuditLog"("hospitalId", "createdAt");

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_hospitalId_fkey"
  FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;
