-- Patients are never hard-deleted: removal sets "deletedAt". Reads must filter "deletedAt" IS NULL.
ALTER TABLE "Patient" ADD COLUMN "deletedAt" TIMESTAMP(3);

DROP INDEX "Patient_hospitalId_idx";
CREATE INDEX "Patient_hospitalId_deletedAt_idx" ON "Patient"("hospitalId", "deletedAt");

-- Safety net below the application: a stray DELETE (or a cascade) cannot erase medical history.
CREATE FUNCTION prevent_patient_hard_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Patient rows are soft-deleted: set "deletedAt" instead of deleting (id=%)', OLD."id"
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Patient_no_hard_delete" BEFORE DELETE ON "Patient"
  FOR EACH ROW EXECUTE FUNCTION prevent_patient_hard_delete();
