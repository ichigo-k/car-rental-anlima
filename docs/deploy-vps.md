# Deploying to the VPS

The live site runs on the Hostinger VPS (Ubuntu 24.04, 168.231.116.95) beside other sites, without changing them:

- Node 22 is installed in `/opt/node22` and used only by ANLIMA; the server's own Node stays as it is.
- The app runs under pm2 as `anlima` on `127.0.0.1:3100` (`deploy/ecosystem.config.cjs`).
- nginx serves `anlimacarrental.com` from its own site file (`deploy/nginx-anlimacarrental.conf`); `www` redirects to the bare domain because forms are accepted only from `BETTER_AUTH_URL`.
- Certbot provides HTTPS and renews it automatically.
- Cron calls `deploy/cron-notifications.sh` every 10 minutes for reminders and message retries.

The code lives in `/var/www/anlima`, checked out on the `deploy` branch. Its `.env` is created on the server and never committed; `BETTER_AUTH_URL` must be `https://anlimacarrental.com`.

## Updating

Push to the `deploy` branch, then on the VPS:

```bash
bash /var/www/anlima/deploy/update.sh
```

It pulls, installs, applies database migrations, builds and restarts. Check the app with `pm2 logs anlima --lines 50`.

## After going live

- Paystack and Flutterwave webhooks: `https://anlimacarrental.com/api/webhooks/paystack` and `/api/webhooks/flutterwave`.
- Resend: verify `anlimacarrental.com` under Domains by adding the DNS records Resend shows.
- Google or Facebook sign-in, if used: callback `https://anlimacarrental.com/api/auth/callback/google` (or `/facebook`).
