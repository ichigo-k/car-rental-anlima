#!/usr/bin/env bash
# Deploys the latest code on the current branch: install, migrate, build and
# restart. Run on the VPS: bash /var/www/anlima/deploy/update.sh
set -euo pipefail
cd /var/www/anlima
export PATH=/opt/node22/bin:$PATH
git pull --ff-only
npm ci
# Migrations take a lock that Neon's pooled connection cannot hold, so they
# use the direct connection (the same address without "-pooler").
url=$(grep -E '^DATABASE_URL=' .env | tail -1 | cut -d= -f2- | tr -d "\"'\r")
DATABASE_URL="${url/-pooler./.}" npx prisma migrate deploy
npm run build
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save
echo "ANLIMA is running: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/)"
