-- Dedicated pharmacy and billing roles. Adding enum values is non-destructive; the new values are only
-- used by rows created after this migration.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PHARMACIST';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BILLING';
