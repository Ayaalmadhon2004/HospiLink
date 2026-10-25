# Backup, archival and retention

## Objectives
| | Target | How |
|---|---|---|
| RPO (max data loss) | 24 h (≤ minutes with Neon PITR) | nightly `pg_dump` + Neon point-in-time restore |
| RTO (time to recover) | 2 h | restore drill below, run quarterly |

## Layers
1. **Neon PITR / branching (primary, fast).** Set the project's history retention to **7 days** (Neon console → Settings → Storage; longer on paid plans). To recover from a bad deploy or delete: *Branches → Create branch → "From past data"*, pick the timestamp, point `DATABASE_URL` (or compare data) at the new branch, then promote/rename. Take a manual branch (`pre-migrate-<date>`) before every production `prisma migrate deploy`.
2. **Nightly logical backup (independent of Neon).** `.github/workflows/db-backup.yml` runs `scripts/backup/pg_backup.sh` at 02:17 UTC: `pg_dump -Fc` → gpg AES-256 → object storage (R2/S3/B2). Never store dumps as GitHub artifacts or in the repo: they contain patient data.
   - Bucket lifecycle (set on the bucket, not in code): **daily copies 35 days, first-of-month copies 12 months**, versioning on, delete protection / object lock on if available.
   - Secrets: `BACKUP_DATABASE_URL` (direct, non-pooled endpoint, read-only role), `BACKUP_PASSPHRASE`, `BACKUP_S3_URI`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL` (R2/B2). Keep the passphrase in a second place (password manager); losing it makes every backup unreadable.
   - Alert: a failed scheduled workflow emails the repo admins; also add an uptime check that the newest object in the bucket is < 26 h old.
3. **Uploads** are stored in `Report.fileData`, so they are in the dump. Legacy `/uploads` files on Render's ephemeral disk are NOT backed up and should be migrated into the DB.

## Restore drill (quarterly, and after changing the backup setup)
```bash
createdb hospilink_restore_test
export RESTORE_DATABASE_URL=postgresql://localhost/hospilink_restore_test BACKUP_PASSPHRASE=...
aws s3 cp s3://<bucket>/hospilink-<stamp>.dump.gpg* .
scripts/backup/pg_restore_check.sh hospilink-<stamp>.dump.gpg
```
Record date, backup used, duration and result in the table at the bottom. The script refuses databases whose name lacks `restore`/`test`.

## Data retention policy
Clinical retention periods are set by national law (commonly 10 years for adult records, longer for minors). **Confirm the period with the hospital's legal/compliance owner before enabling any purge**; the defaults below are proposals.

| Data | Live (online) | Then | Notes |
|---|---|---|---|
| Patients, appointments, reports | indefinite | soft-deleted rows kept for the legal period, then anonymised | `Patient` is never hard-deleted (DB trigger) |
| `PatientVitals` | 24 months | archive to cold storage (Parquet/CSV, encrypted), then delete rows | the largest table; keep `isCritical` rows 10 y |
| `AuditLog` | 24 months | archive 7 y, then delete | `userId` is `SetNull`, the trail outlives users |
| `Notification` | 90 days (read), 180 days (unread) | delete | |
| `AuthToken` (reset/verify) | until used/expired + 7 days | delete | |
| `ReminderLog` | 30 days | delete | |
| `DeviceKey` revoked | 12 months | delete | |
| Backups | 35 d daily / 12 m monthly | bucket lifecycle expiry | deleted patients persist in backups until they expire: say so in the privacy notice |

Implementation plan (next PR, `chore/retention-job`): a `services/retention.service.ts` with batched `deleteMany` (e.g. 5 000 rows per statement, `createdAt < cutoff`) for the "delete" rows above, called from `POST /api/internal/run-retention` (same `x-…-secret` pattern as `run-reminders`, Render Cron weekly), logging counts; vitals/audit rows are exported to the archive bucket *before* deletion and the job aborts if the export fails. Add an index on `Notification(createdAt)` / `AuditLog(createdAt)` in the same migration.

## Restore drill log
| Date | Backup | Duration | Result | By |
|---|---|---|---|---|
| | | | | |
