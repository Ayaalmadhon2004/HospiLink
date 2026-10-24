-- Patient.doctorId pointed at "User" while Appointment.doctorId points at "Staff". Both now reference "Staff"
-- (the clinical record; its login is Staff.userId).

-- Drop the old FK first, otherwise the rewritten ids below would violate it.
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_doctorId_fkey";

-- Translate User ids to the Staff row linked to that user (same hospital). A doctor without a Staff
-- record cannot be represented any more, so the reference is cleared.
UPDATE "Patient" p
SET "doctorId" = s."id"
FROM "Staff" s
WHERE p."doctorId" IS NOT NULL AND s."userId" = p."doctorId" AND s."hospitalId" = p."hospitalId";

UPDATE "Patient" p
SET "doctorId" = NULL
WHERE p."doctorId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Staff" s WHERE s."id" = p."doctorId");

CREATE INDEX "Patient_doctorId_idx" ON "Patient"("doctorId");

ALTER TABLE "Patient" ADD CONSTRAINT "Patient_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
