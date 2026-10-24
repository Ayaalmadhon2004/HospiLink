-- A doctor cannot have two overlapping non-cancelled appointments. The application checks first
-- (friendly 409); this constraint closes the race between two concurrent requests.
--
-- BEFORE deploying, make sure production has no overlaps, or the ALTER TABLE below fails:
--   SELECT a.id, b.id FROM "Appointment" a JOIN "Appointment" b
--     ON a."doctorId" = b."doctorId" AND a.id < b.id
--    AND a.status <> 'CANCELLED' AND b.status <> 'CANCELLED'
--    AND a."scheduledAt" < b."scheduledAt" + make_interval(mins => b."duration")
--    AND b."scheduledAt" < a."scheduledAt" + make_interval(mins => a."duration");
-- Cancel or reschedule the rows it returns first.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
  ADD CONSTRAINT appointment_no_doctor_overlap
  EXCLUDE USING gist (
    "doctorId" WITH =,
    tsrange("scheduledAt", "scheduledAt" + make_interval(mins => "duration")) WITH &&
  )
  WHERE (status <> 'CANCELLED');
