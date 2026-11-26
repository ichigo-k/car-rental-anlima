# Monitoring and alerts

Guide FR-023. Code: `src/lib/monitoring.ts`, `src/instrumentation.ts`; staff view: **System health** (`/admin/system`, administrators and managers).

## Alerts

Alerts are emails to `OPERATIONS_EMAIL`. Set it to a real inbox; until then nothing is sent and System health says so. Each alert repeats at most every six hours while the problem lasts (server errors: at most hourly per error).

| Alert | When |
| --- | --- |
| Server error | Any error on a page, API route or form, grouped by message and route. Query strings are never stored, because they can hold tokens. |
| Messages could not be sent | An email or text failed in the last 24 hours |
| Messages are waiting | A message has been queued for more than 30 minutes (for example, provider keys missing) |
| Refunds need checking | A refund's outcome was lost; see `docs/refunds.md` |
| Refunds are taking long | A refund has been in progress for more than 15 days |
| Payments need review | A paid booking is in payment review |
| Backup failed / no recent backup | The nightly backup failed or has not run for 26 hours |
| Fleet tracking unavailable | Tracksolid returned an error for linked trackers |

The scheduled job (`/api/cron/notifications`, every 10 minutes) runs these checks and records that it ran.

## Health check

`GET /api/health` returns `{"status": "ok" | "degraded" | "down", "checks": {...}}`:

- **Checks:** database, photo storage, scheduled job (ran in the last 30 minutes) and backups (one in the last 26 hours).
- **Status codes:** "down" (database or storage unusable) returns HTTP 503; everything else returns 200.
- **Privacy:** no details are public.

### Uptime monitor (outside the server)

The server cannot report its own outage, so add a free external monitor, for example UptimeRobot:

1. Create a **Keyword** monitor for `https://anlimacarrental.com/api/health`, every 5 minutes, alerting when the keyword `"status":"ok"` is **missing**.
2. Send its alerts to the operations email and, if offered, SMS.

That catches the site being down, the server being off, the scheduled job stopping and missed backups.

## On the server

- `deploy/watchdog.sh` (every 5 minutes) restarts ANLIMA through pm2 if it stops answering, and logs to `/var/log/anlima-watchdog.log`. It does not restart for a database outage, which a restart cannot fix.
- `deploy/update.sh` runs the unit tests before building, puts the previous code back if anything fails before the restart, and rolls back to the previous version if the site is not healthy after it. Database migrations only add to the database, so the previous version keeps working after a rollback.
- Application logs: `pm2 logs anlima`. To stop logs filling the disk, install pm2's log rotation once: `pm2 install pm2-logrotate` (it applies to every pm2 app on the server, which is usually wanted).
