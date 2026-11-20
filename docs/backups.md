# Backups and restore test

Guide FR-023 and AC-10. Scripts: `deploy/backup.sh` and `deploy/restore-test.sh`. Results appear on **System health** and in the activity history, and a failed or missing backup sends an alert.

## What is backed up

- **The database:** every night, a full `pg_dump` over Neon's direct connection.
- **Photos:** the handover and return photo folder (`UPLOAD_DIR`, default `/var/www/anlima/storage/uploads`).

Both go to `/var/backups/anlima` (readable by root only) and are kept for 14 days (`BACKUP_KEEP_DAYS`).

Neon also keeps its own history, so the database can be restored to a recent point in time from the Neon console. How far back depends on the Neon plan.

**Off-site copies.** The nightly files live on the same VPS, so they do not protect against losing the VPS itself. Enable Hostinger's VPS backups or snapshots, or copy `/var/backups/anlima` elsewhere (for example with `rclone` to cloud storage).

## Setting up (once, on the VPS)

The database is PostgreSQL 18, so the server needs the version 18 client tools from PostgreSQL's official package source. This adds the client only; no database server is installed:

```bash
apt install -y postgresql-common
/usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
apt install -y postgresql-client-18
pg_dump --version
```

Then add the schedule (times are server time, UTC):

```bash
( crontab -l 2>/dev/null | grep -v -e anlima/deploy/backup.sh -e anlima/deploy/restore-test.sh -e anlima/deploy/watchdog.sh
  echo '30 2 * * * bash /var/www/anlima/deploy/backup.sh >> /var/log/anlima-backup.log 2>&1'
  echo '30 3 * * 0 bash /var/www/anlima/deploy/restore-test.sh >> /var/log/anlima-backup.log 2>&1'
  echo '*/5 * * * * bash /var/www/anlima/deploy/watchdog.sh'
) | crontab -
```

Run both once by hand to check: `bash /var/www/anlima/deploy/backup.sh`, then `bash /var/www/anlima/deploy/restore-test.sh`.

## Restore test (weekly)

`restore-test.sh` runs every Sunday. It restores the latest database backup into a temporary PostgreSQL 18 container (Docker), then checks:

- the tables were restored;
- there are cars and users;
- the app's own schema check (`prisma migrate status`) accepts the restored database as matching this release.

It then deletes the container. The live database is never touched.

## Restoring for real

1. Stop the app: `pm2 stop anlima`.
2. Database:
   - **Neon point-in-time restore** is usually best.
   - **From a nightly file:** `pg_restore --clean --if-exists --no-owner --no-privileges --dbname="<direct DATABASE_URL>" /var/backups/anlima/db-YYYYMMDD-HHMM.dump`.
3. Photos: `tar -xzf /var/backups/anlima/photos-YYYYMMDD-HHMM.tar.gz -C /var/www/anlima/storage`.
4. Start the app (`pm2 start anlima`) and check `https://anlimacarrental.com/api/health`.
