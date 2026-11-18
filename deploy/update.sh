#!/usr/bin/env bash
# Deploys the latest code on the current branch: install, migrate, build and
# restart. Run on the VPS: bash /var/www/anlima/deploy/update.sh
set -euo pipefail
cd /var/www/anlima
export PATH=/opt/node22/bin:$PATH
git pull --ff-only
npm ci
npx prisma migrate deploy
npm run build
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save
echo "ANLIMA is running: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/)"
