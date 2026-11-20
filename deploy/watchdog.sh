#!/usr/bin/env bash
# Run every 5 minutes by cron: restarts ANLIMA if it stops answering on the
# server. A 503 means the database or storage is down, which a restart does not
# fix, so that is only logged. Other sites on the server are not touched.
LOG=/var/log/anlima-watchdog.log
check() { curl -s -o /dev/null -m 15 -w '%{http_code}' http://127.0.0.1:3100/api/health; }
code=$(check)
[ "$code" = 200 ] && exit 0
sleep 20
code=$(check)
[ "$code" = 200 ] && exit 0
if [ "$code" = 503 ]; then
  echo "$(date -u +%FT%TZ) health 503 (database or storage down); not restarting" >>"$LOG"
  exit 0
fi
echo "$(date -u +%FT%TZ) no healthy answer (HTTP $code); restarting anlima" >>"$LOG"
PATH=/opt/node22/bin:$PATH pm2 restart anlima >>"$LOG" 2>&1
