#!/usr/bin/env bash
# Deploys the latest code on the current branch: install, unit tests,
# migrations, build and restart, then a health check. If anything fails before
# the restart, the previous code is put back; if the site is not healthy after
# the restart, the previous version is rebuilt and restarted.
# Run on the VPS: bash /var/www/anlima/deploy/update.sh
set -Eeuo pipefail
cd /var/www/anlima
export PATH=/opt/node22/bin:$PATH
prev=$(git rev-parse HEAD)
restore_code() {
  echo "Update stopped; putting back $(git log --oneline -1 "$prev")" >&2
  git reset -q --hard "$prev"
  npm ci --silent
}
trap restore_code ERR
git pull --ff-only
npm ci
npm test
# Migrations take a lock that Neon's pooled connection cannot hold, so they
# use the direct connection (the same address without "-pooler"). They only
# add to the database, so earlier code keeps working if this update is undone.
url=$(grep -E '^DATABASE_URL=' .env | tail -1 | cut -d= -f2- | tr -d "\"'\r")
DATABASE_URL="${url/-pooler./.}" npx prisma migrate deploy
npm run build
trap - ERR
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
healthy() {
  for _ in $(seq 1 30); do
    [ "$(curl -s -o /dev/null -m 10 -w '%{http_code}' http://127.0.0.1:3100/api/health)" = 200 ] && return 0
    sleep 2
  done
  return 1
}
if healthy; then
  pm2 save
  echo "ANLIMA is running $(git log --oneline -1)"
else
  echo "The new version is not healthy; rolling back to $(git log --oneline -1 "$prev")" >&2
  git reset -q --hard "$prev"
  npm ci --silent
  npm run build
  pm2 startOrReload deploy/ecosystem.config.cjs --update-env
  healthy && echo "Rolled back; the previous version is running." >&2
  exit 1
fi
