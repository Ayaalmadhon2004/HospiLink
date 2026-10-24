-- Hospital-local time zone (IANA name). Existing hospitals keep UTC until an admin sets it.
ALTER TABLE "Hospital" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';
