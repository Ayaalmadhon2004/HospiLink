-- Full multi-tenancy: Staff, Incident, DispatchUnit and DispatchCall now belong to a Hospital.
-- Existing rows predate multi-tenancy (single hospital), so they are backfilled in three steps:
-- add the column as nullable, fill it, then make it NOT NULL. Staff follow the hospital of the
-- User with the same email (the login/staff link used by the app), otherwise the oldest hospital.

-- AlterTable (nullable first)
ALTER TABLE "Staff" ADD COLUMN "hospitalId" TEXT;
ALTER TABLE "Incident" ADD COLUMN "hospitalId" TEXT;
ALTER TABLE "DispatchUnit" ADD COLUMN "hospitalId" TEXT;
ALTER TABLE "DispatchCall" ADD COLUMN "hospitalId" TEXT;

-- Backfill
UPDATE "Staff" s SET "hospitalId" = u."hospitalId" FROM "User" u WHERE u."email" = s."email";
UPDATE "Staff" SET "hospitalId" = (SELECT "id" FROM "Hospital" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1) WHERE "hospitalId" IS NULL;
UPDATE "Incident" SET "hospitalId" = (SELECT "id" FROM "Hospital" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
UPDATE "DispatchUnit" SET "hospitalId" = (SELECT "id" FROM "Hospital" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
UPDATE "DispatchCall" SET "hospitalId" = (SELECT "id" FROM "Hospital" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);

-- Enforce (fails loudly if rows exist but there is no Hospital to attach them to)
ALTER TABLE "Staff" ALTER COLUMN "hospitalId" SET NOT NULL;
ALTER TABLE "Incident" ALTER COLUMN "hospitalId" SET NOT NULL;
ALTER TABLE "DispatchUnit" ALTER COLUMN "hospitalId" SET NOT NULL;
ALTER TABLE "DispatchCall" ALTER COLUMN "hospitalId" SET NOT NULL;

-- Codes are now unique per hospital instead of globally
DROP INDEX "Incident_code_key";
DROP INDEX "DispatchUnit_unitCode_key";

-- CreateIndex
CREATE INDEX "Patient_hospitalId_idx" ON "Patient"("hospitalId");
CREATE INDEX "Ward_hospitalId_idx" ON "Ward"("hospitalId");
CREATE INDEX "Bed_hospitalId_idx" ON "Bed"("hospitalId");
CREATE INDEX "Staff_hospitalId_idx" ON "Staff"("hospitalId");
CREATE INDEX "Incident_hospitalId_idx" ON "Incident"("hospitalId");
CREATE UNIQUE INDEX "Incident_hospitalId_code_key" ON "Incident"("hospitalId", "code");
CREATE INDEX "DispatchUnit_hospitalId_idx" ON "DispatchUnit"("hospitalId");
CREATE UNIQUE INDEX "DispatchUnit_hospitalId_unitCode_key" ON "DispatchUnit"("hospitalId", "unitCode");
CREATE INDEX "DispatchCall_hospitalId_idx" ON "DispatchCall"("hospitalId");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DispatchUnit" ADD CONSTRAINT "DispatchUnit_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DispatchCall" ADD CONSTRAINT "DispatchCall_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
