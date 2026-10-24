-- Explicit referential actions. Nothing clinical is cascaded away by deleting a parent any more:
--   Bed -> Ward / Hospital, Incident -> Hospital, Staff -> Hospital   : RESTRICT (delete children first)
--   Shift -> Staff                                                     : CASCADE (a schedule row is meaningless without its staff member)
-- Appointment -> Staff/Patient and Patient -> Bed/Hospital keep their existing RESTRICT / SET NULL behaviour (now spelled out in schema.prisma).

ALTER TABLE "Bed" DROP CONSTRAINT "Bed_hospitalId_fkey";
ALTER TABLE "Bed" DROP CONSTRAINT "Bed_wardId_fkey";
ALTER TABLE "Incident" DROP CONSTRAINT "Incident_hospitalId_fkey";
ALTER TABLE "Staff" DROP CONSTRAINT "Staff_hospitalId_fkey";
ALTER TABLE "Shift" DROP CONSTRAINT "Shift_staffId_fkey";

CREATE INDEX "Bed_wardId_idx" ON "Bed"("wardId");
CREATE INDEX "Shift_staffId_startTime_idx" ON "Shift"("staffId", "startTime");

ALTER TABLE "Bed" ADD CONSTRAINT "Bed_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
