#!/usr/bin/env bash
# Encrypted logical backup of the HospiLink database (Neon/PostgreSQL).
#   BACKUP_DATABASE_URL  connection string (use the DIRECT, non-pooled Neon endpoint; a read-only role is enough)
#   BACKUP_PASSPHRASE    encrypts the dump (gpg AES256); keep it in a secret manager, NOT next to the backups
#   BACKUP_DIR           output directory (default ./backups)
#   BACKUP_KEEP_DAYS     local retention (default 14); long-term retention lives in the bucket lifecycle rules
#   BACKUP_S3_URI        optional s3://bucket/prefix (needs aws cli; works with R2/B2 via AWS_ENDPOINT_URL)
set -euo pipefail

: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is required}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/hospilink-$stamp.dump.gpg"

mkdir -p "$BACKUP_DIR"
umask 077

# -Fc = custom format (compressed, supports selective/parallel restore). Streamed straight into gpg: no plaintext on disk.
pg_dump --format=custom --no-owner --no-privileges "$BACKUP_DATABASE_URL" \
  | gpg --batch --yes --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" --symmetric --cipher-algo AES256 --output "$out"

# A truncated pipe still exits 0 from gpg in some failure modes: refuse suspiciously small files.
size=$(stat -c %s "$out")
if [ "$size" -lt 1024 ]; then echo "backup too small ($size bytes), aborting" >&2; rm -f "$out"; exit 1; fi

( cd "$BACKUP_DIR" && sha256sum "$(basename "$out")" > "$(basename "$out").sha256" )
echo "backup written: $out ($size bytes)"

if [ -n "${BACKUP_S3_URI:-}" ]; then
  aws s3 cp "$out" "${BACKUP_S3_URI%/}/" --only-show-errors
  aws s3 cp "$out.sha256" "${BACKUP_S3_URI%/}/" --only-show-errors
  echo "uploaded to ${BACKUP_S3_URI}"
fi

find "$BACKUP_DIR" -name 'hospilink-*.dump.gpg*' -mtime +"$BACKUP_KEEP_DAYS" -delete
