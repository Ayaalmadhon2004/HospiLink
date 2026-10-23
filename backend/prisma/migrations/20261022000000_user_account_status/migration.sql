-- Self-registered users start as PENDING and cannot use the API until an ADMIN activates them.
-- Existing users keep working: the column defaults to ACTIVE.
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

ALTER TABLE "User" ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';
