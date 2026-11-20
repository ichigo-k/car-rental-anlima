#!/usr/bin/env bash
# Daily backup of the database (pg_dump) and the photo folder into
# /var/backups/anlima, kept for 14 days, then reported to the app so the
# System health page and the alerts know. Run by cron; see docs/backups.md.
set -uo pipefail
APP=/var/www/anlima
DEST=${BACKUP_DIR:-/var/backups/anlima}
KEEP_DAYS=${BACKUP_KEEP_DAYS:-14}
DB_MAJOR=18
env_value() { grep -E "^$1=" "$APP/.env" | tail -1 | cut -d= -f2- | tr -d "\"'\r"; }
report() {
  curl -fsS -m 30 -X POST http://127.0.0.1:3100/api/cron/report \
    -H "Authorization: Bearer $(env_value CRON_SECRET)" \
    -H "Content-Type: application/json" \
    -d "{\"kind\":\"backup\",\"ok\":$1,\"detail\":\"$2\"}" >/dev/null ||
    echo "Could not report the result to the app" >&2
}
fail() {
  echo "BACKUP FAILED: $1" >&2
  report false "$1"
  exit 1
}

url=$(env_value DATABASE_URL)
url="${url/-pooler./.}" # dumps need Neon's direct connection
[ -n "$url" ] || fail "DATABASE_URL is not set in $APP/.env"
command -v pg_dump >/dev/null || fail "pg_dump is not installed (postgresql-client-$DB_MAJOR)"
have=$(pg_dump --version | grep -oE '[0-9]+' | head -1)
[ "$have" -ge "$DB_MAJOR" ] || fail "pg_dump $have is older than the database (PostgreSQL $DB_MAJOR)"

umask 077
mkdir -p "$DEST"
stamp=$(date -u +%Y%m%d-%H%M)
db_file="$DEST/db-$stamp.dump"
pg_dump --format=custom --no-owner --no-privileges --file="$db_file" "$url" ||
  { rm -f "$db_file"; fail "pg_dump could not dump the database"; }

uploads=$(env_value UPLOAD_DIR)
uploads=${uploads:-$APP/storage/uploads}
mkdir -p "$uploads"
tar -czf "$DEST/photos-$stamp.tar.gz" -C "$(dirname "$uploads")" "$(basename "$uploads")" ||
  fail "could not archive the photo folder"

find "$DEST" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'photos-*.tar.gz' \) \
  -mtime +"$KEEP_DAYS" -delete
size() { du -h "$1" | cut -f1; }
report true "database $(size "$db_file"), photos $(size "$DEST/photos-$stamp.tar.gz"), keeping $KEEP_DAYS days"
echo "Backup OK: $db_file"
