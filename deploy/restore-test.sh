#!/usr/bin/env bash
# Restore test (Guide AC-10): restores the latest database backup into a
# throwaway PostgreSQL container, checks the data and that the app's schema
# matches, then deletes the container. Nothing touches the live database.
# Reports the result to the app. Run weekly by cron; see docs/backups.md.
set -uo pipefail
APP=/var/www/anlima
DEST=${BACKUP_DIR:-/var/backups/anlima}
NAME=anlima-restore-test
PORT=55432
export PATH=/opt/node22/bin:$PATH
env_value() { grep -E "^$1=" "$APP/.env" | tail -1 | cut -d= -f2- | tr -d "\"'\r"; }
report() {
  curl -fsS -m 30 -X POST http://127.0.0.1:3100/api/cron/report \
    -H "Authorization: Bearer $(env_value CRON_SECRET)" \
    -H "Content-Type: application/json" \
    -d "{\"kind\":\"restore-test\",\"ok\":$1,\"detail\":\"$2\"}" >/dev/null ||
    echo "Could not report the result to the app" >&2
}
fail() {
  echo "RESTORE TEST FAILED: $1" >&2
  report false "$1"
  exit 1
}

latest=$(ls -1t "$DEST"/db-*.dump 2>/dev/null | head -1)
[ -n "$latest" ] || fail "no database backup found in $DEST"
command -v docker >/dev/null || fail "docker is not installed"
command -v pg_restore >/dev/null || fail "pg_restore is not installed"

password=$(openssl rand -hex 16)
docker rm -f "$NAME" >/dev/null 2>&1
docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD="$password" \
  -p 127.0.0.1:$PORT:5432 postgres:18 >/dev/null || fail "could not start a test database"
trap 'docker rm -f "$NAME" >/dev/null 2>&1' EXIT
for _ in $(seq 1 60); do
  docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 2
done
target="postgresql://postgres:$password@127.0.0.1:$PORT/postgres"

pg_restore --no-owner --no-privileges --dbname="$target" "$latest" 2>/tmp/anlima-restore.log ||
  echo "pg_restore reported warnings; see /tmp/anlima-restore.log" >&2
q() { psql "$target" -At -c "$1" 2>/dev/null; }
tables=$(q "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
[ "${tables:-0}" -ge 20 ] || fail "only ${tables:-0} tables were restored from $(basename "$latest")"
cars=$(q 'SELECT count(*) FROM "Vehicle"')
users=$(q 'SELECT count(*) FROM "User"')
bookings=$(q 'SELECT count(*) FROM "Booking"')
[ "${cars:-0}" -gt 0 ] && [ "${users:-0}" -gt 0 ] || fail "the restored database has no cars or users"
# The app's own check: every migration in this release is in the backup.
(cd "$APP" && DATABASE_URL="$target" npx prisma migrate status >/tmp/anlima-restore-migrate.log 2>&1) ||
  fail "the restored schema does not match this release (see /tmp/anlima-restore-migrate.log)"

report true "$(basename "$latest"): $tables tables, $cars cars, $users users, $bookings bookings; schema up to date"
echo "Restore test PASSED: $(basename "$latest")"
