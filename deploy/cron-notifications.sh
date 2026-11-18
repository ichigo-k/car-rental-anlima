#!/usr/bin/env bash
# Run by cron every 10 minutes: sends booking reminders and retries messages.
set -euo pipefail
secret=$(grep -E '^CRON_SECRET=' /var/www/anlima/.env | cut -d= -f2- | tr -d "\"'\r")
curl -fsS -m 60 -H "Authorization: Bearer $secret" \
  http://127.0.0.1:3100/api/cron/notifications >/dev/null
