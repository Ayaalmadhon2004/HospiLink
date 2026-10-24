-- Real link between a staff member and their login. Before this, appointment/shift notifications and
-- reminders found the login by matching Staff.email with User.email, so a typo silently lost them.
ALTER TABLE "Staff" ADD COLUMN "userId" TEXT;

-- Backfill from the old convention: same email (case-insensitive) AND same hospital, strictly one-to-one
-- (ambiguous matches stay unlinked). Never links across hospitals.
WITH pairs AS (
  SELECT s.id AS sid, u.id AS uid
  FROM "Staff" s
  JOIN "User" u ON lower(u.email) = lower(s.email) AND u."hospitalId" = s."hospitalId"
), ranked AS (
  SELECT sid, uid,
         row_number() OVER (PARTITION BY sid ORDER BY uid) AS per_staff,
         row_number() OVER (PARTITION BY uid ORDER BY sid) AS per_user
  FROM pairs
)
UPDATE "Staff" s SET "userId" = r.uid
FROM ranked r
WHERE s.id = r.sid AND r.per_staff = 1 AND r.per_user = 1;

CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId");

ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
