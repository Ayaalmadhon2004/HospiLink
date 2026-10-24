-- Data repair for the rule "a bed is OCCUPIED if and only if a patient is assigned to it".
-- Patient updates and bed updates used to change one side only, so production may contain beds that say
-- AVAILABLE with a patient in them (or OCCUPIED with nobody). The application now enforces the rule; this aligns old rows.

-- 1. A discharged patient holds no bed.
UPDATE "Bed" b SET "status" = 'AVAILABLE'
FROM "Patient" p
WHERE p."bedId" = b."id" AND p."status" = 'DISCHARGED';

UPDATE "Patient" SET "bedId" = NULL WHERE "status" = 'DISCHARGED' AND "bedId" IS NOT NULL;

-- 2. A bed with a patient is OCCUPIED (the patient is physically there, whatever the bed said).
UPDATE "Bed" SET "status" = 'OCCUPIED'
WHERE "id" IN (SELECT "bedId" FROM "Patient" WHERE "bedId" IS NOT NULL) AND "status" <> 'OCCUPIED';

-- 3. A bed without a patient is not OCCUPIED.
UPDATE "Bed" SET "status" = 'AVAILABLE'
WHERE "status" = 'OCCUPIED' AND "id" NOT IN (SELECT "bedId" FROM "Patient" WHERE "bedId" IS NOT NULL);
