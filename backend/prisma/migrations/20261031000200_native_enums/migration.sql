-- Free-form String columns -> native enums.
-- Values are normalised first (trim, upper-case, spaces/hyphens -> '_': 'On Duty' -> ON_DUTY, 'Day' -> DAY).
-- A value that still is not in the enum ABORTS the migration (nothing is silently rewritten): fix those rows by hand, re-run.
-- Check beforehand: SELECT DISTINCT "type" FROM "Shift"; (and the other columns below).

CREATE TYPE "ShiftType" AS ENUM ('DAY','EVENING','NIGHT','ON_CALL');

UPDATE "Shift" SET "type" = upper(regexp_replace(btrim("type"), '[\s-]+', '_', 'g'));
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT '"' || "type" || '"', ', ') INTO bad FROM "Shift" WHERE "type" NOT IN ('DAY','EVENING','NIGHT','ON_CALL');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot convert Shift.type to ShiftType: unknown values %', bad;
  END IF;
END $$;
ALTER TABLE "Shift" ALTER COLUMN "type" TYPE "ShiftType" USING "type"::"ShiftType";

UPDATE "User" SET "shift" = upper(regexp_replace(btrim("shift"), '[\s-]+', '_', 'g'));
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT '"' || "shift" || '"', ', ') INTO bad FROM "User" WHERE "shift" NOT IN ('DAY','EVENING','NIGHT','ON_CALL');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot convert User.shift to ShiftType: unknown values %', bad;
  END IF;
END $$;
ALTER TABLE "User" ALTER COLUMN "shift" TYPE "ShiftType" USING "shift"::"ShiftType";

CREATE TYPE "DutyStatus" AS ENUM ('ON_DUTY','OFF_DUTY');

UPDATE "User" SET "status" = upper(regexp_replace(btrim("status"), '[\s-]+', '_', 'g'));
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT '"' || "status" || '"', ', ') INTO bad FROM "User" WHERE "status" NOT IN ('ON_DUTY','OFF_DUTY');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot convert User.status to DutyStatus: unknown values %', bad;
  END IF;
END $$;
ALTER TABLE "User" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "status" TYPE "DutyStatus" USING "status"::"DutyStatus";
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'OFF_DUTY';

CREATE TYPE "AppointmentType" AS ENUM ('CONSULTATION','SURGERY','IMAGING','FOLLOW_UP','LAB_TEST');

UPDATE "Appointment" SET "type" = upper(regexp_replace(btrim("type"), '[\s-]+', '_', 'g'));
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT '"' || "type" || '"', ', ') INTO bad FROM "Appointment" WHERE "type" NOT IN ('CONSULTATION','SURGERY','IMAGING','FOLLOW_UP','LAB_TEST');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot convert Appointment.type to AppointmentType: unknown values %', bad;
  END IF;
END $$;
ALTER TABLE "Appointment" ALTER COLUMN "type" TYPE "AppointmentType" USING "type"::"AppointmentType";

CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW');

UPDATE "Appointment" SET "status" = upper(regexp_replace(btrim("status"), '[\s-]+', '_', 'g'));
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT '"' || "status" || '"', ', ') INTO bad FROM "Appointment" WHERE "status" NOT IN ('SCHEDULED','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot convert Appointment.status to AppointmentStatus: unknown values %', bad;
  END IF;
END $$;
-- The overlap exclusion constraint compares status as text: drop it, change the type, re-create it with the enum literal.
ALTER TABLE "Appointment" DROP CONSTRAINT appointment_no_doctor_overlap;
ALTER TABLE "Appointment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Appointment" ALTER COLUMN "status" TYPE "AppointmentStatus" USING "status"::"AppointmentStatus";
ALTER TABLE "Appointment" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
ALTER TABLE "Appointment"
  ADD CONSTRAINT appointment_no_doctor_overlap
  EXCLUDE USING gist (
    "doctorId" WITH =,
    tsrange("scheduledAt", "scheduledAt" + make_interval(mins => "duration")) WITH &&
  )
  WHERE (status <> 'CANCELLED');

CREATE TYPE "IncidentType" AS ENUM ('MEDICAL_ERROR','EQUIPMENT_FAILURE','PATIENT_FALL','SECURITY','OTHER');

UPDATE "Incident" SET "type" = upper(regexp_replace(btrim("type"), '[\s-]+', '_', 'g'));
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT '"' || "type" || '"', ', ') INTO bad FROM "Incident" WHERE "type" NOT IN ('MEDICAL_ERROR','EQUIPMENT_FAILURE','PATIENT_FALL','SECURITY','OTHER');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot convert Incident.type to IncidentType: unknown values %', bad;
  END IF;
END $$;
ALTER TABLE "Incident" ALTER COLUMN "type" TYPE "IncidentType" USING "type"::"IncidentType";

CREATE TYPE "IncidentSeverity" AS ENUM ('CRITICAL','ELEVATED','MODERATE','LOW');

UPDATE "Incident" SET "severity" = upper(regexp_replace(btrim("severity"), '[\s-]+', '_', 'g'));
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT '"' || "severity" || '"', ', ') INTO bad FROM "Incident" WHERE "severity" NOT IN ('CRITICAL','ELEVATED','MODERATE','LOW');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot convert Incident.severity to IncidentSeverity: unknown values %', bad;
  END IF;
END $$;
ALTER TABLE "Incident" ALTER COLUMN "severity" TYPE "IncidentSeverity" USING "severity"::"IncidentSeverity";

CREATE TYPE "IncidentStatus" AS ENUM ('ACTIVE','PENDING','RESOLVED');

UPDATE "Incident" SET "status" = upper(regexp_replace(btrim("status"), '[\s-]+', '_', 'g'));
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT '"' || "status" || '"', ', ') INTO bad FROM "Incident" WHERE "status" NOT IN ('ACTIVE','PENDING','RESOLVED');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot convert Incident.status to IncidentStatus: unknown values %', bad;
  END IF;
END $$;
ALTER TABLE "Incident" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Incident" ALTER COLUMN "status" TYPE "IncidentStatus" USING "status"::"IncidentStatus";
ALTER TABLE "Incident" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

