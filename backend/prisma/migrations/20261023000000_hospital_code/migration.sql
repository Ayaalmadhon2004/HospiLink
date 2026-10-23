-- Public signup joins a hospital through its code instead of "the first hospital".
-- Existing hospitals get a code derived from their id; an admin can change it in the database.
ALTER TABLE "Hospital" ADD COLUMN "code" TEXT;

UPDATE "Hospital" SET "code" = UPPER(SUBSTRING(REPLACE("id", '-', ''), 1, 8));

ALTER TABLE "Hospital" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "Hospital_code_key" ON "Hospital"("code");
