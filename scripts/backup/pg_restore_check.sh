#!/usr/bin/env bash
# Restore drill: decrypt a backup into a THROWAWAY database and sanity-check it. An untested backup is not a backup.
#   usage: pg_restore_check.sh <backup.dump.gpg>
#   RESTORE_DATABASE_URL  empty scratch database; its name must contain "restore" or "test" (refuses anything else)
#   BACKUP_PASSPHRASE     same passphrase used by pg_backup.sh
set -euo pipefail

file="${1:?usage: pg_restore_check.sh <backup.dump.gpg>}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is required}"

dbname="${RESTORE_DATABASE_URL##*/}"; dbname="${dbname%%\?*}"
case "$dbname" in *restore*|*test*) ;; *) echo "refusing to restore into '$dbname' (name must contain restore/test)" >&2; exit 1;; esac

[ ! -f "$file.sha256" ] || ( cd "$(dirname "$file")" && sha256sum -c "$(basename "$file").sha256" )

gpg --batch --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" --decrypt "$file" \
  | pg_restore --no-owner --no-privileges --clean --if-exists --dbname "$RESTORE_DATABASE_URL"

for t in '"User"' '"Patient"' '"Bed"' '"PatientVitals"' '"AuditLog"'; do
  n=$(psql "$RESTORE_DATABASE_URL" -tAc "SELECT count(*) FROM $t")
  echo "$t rows: $n"
done
psql "$RESTORE_DATABASE_URL" -tAc "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL" | sed 's/^/applied migrations: /'
echo "restore check OK"
