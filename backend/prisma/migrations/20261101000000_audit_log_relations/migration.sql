-- AuditLog.userId becomes a real FK to "User". Audit rows must outlive a deleted login, so the column is nullable
-- and the FK is ON DELETE SET NULL.

ALTER TABLE "AuditLog" ALTER COLUMN "userId" DROP NOT NULL;

-- Rows pointing at a user that no longer exists would make the FK fail: keep them, just detach them.
UPDATE "AuditLog" SET "userId" = NULL
WHERE "userId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = "AuditLog"."userId");

CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
