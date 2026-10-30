# ANLIMA Car Rental

Next.js App Router, TypeScript, Prisma/PostgreSQL, Better Auth, and Paystack. Public catalogue, availability search, authenticated reservations, payment verification, staff operations, and mock GPS.

## Start

1. Install Node.js 22+ and run `npm install`.
2. Copy `.env.example` to `.env`. Set `DATABASE_URL`, a random `BETTER_AUTH_SECRET` (at least 32 characters), and `BETTER_AUTH_URL`.
3. Run `npm run db:generate`, `npm run db:migrate`, and optionally `npm run db:seed` (four illustrative vehicles; never real inventory).
4. Run `npm run dev` and open http://localhost:3000.

The application reuses one Prisma connection pool per process. Database connections default to a 15-second connection timeout and a 20-second pool wait to accommodate cold starts; explicit `connect_timeout` and `pool_timeout` values in `DATABASE_URL` take precedence. A database outage still requires recovery of the database or network; the error page provides a manual retry that refetches the page.

## Google and Facebook sign-in

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Google, and `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET` for Meta/Facebook. Both values for a provider must be present before its sign-in button is enabled. Keep these secrets server-side and restart the app after changing them.

Register `http://localhost:3000/api/auth/callback/google` with Google and `http://localhost:3000/api/auth/callback/facebook` with Meta for local development. For deployment, register the same paths on your HTTPS `BETTER_AUTH_URL` domain. Configure the providers' consent screens, allowed test users, and publishing requirements in their dashboards. Sign-in returns customers to the car or account page they were visiting. Email sign-in remains available without OAuth credentials.

## Paystack

Set `PAYSTACK_SECRET_KEY` to a Paystack test secret first. Configure the webhook as `https://YOUR_DOMAIN/api/webhooks/paystack`. The callback is `/api/payments/callback`. Initialization uses GHS pesewas. Server verification checks reference, amount, currency, and provider status. Webhooks require an HMAC SHA512 signature and repeat verification against Paystack. Duplicate deliveries do not create duplicate confirmations. Never put the secret in a public environment variable.

A booking gets a 15-minute hold. Expired holds are ignored by availability searches. Vehicle row locks serialize booking creation and payment confirmation. Late payment that conflicts with a new hold, inactive vehicle, or maintenance block becomes PAYMENT_REVIEW for staff resolution; it is never falsely confirmed. Staff must arrange refunds through Paystack until a reviewed refund workflow is implemented.

## Staff

`/admin` provides an operations overview, searchable bookings with handover/return inspections, and car management (listing details, rates, pickup points and date blocks). `/admin/promotions` lets ADMIN and MANAGER users create/edit/pause percentage or fixed-GHS offers. FINANCE can view offers. Leave the code blank for automatic discounts, or set a coupon/voucher code; target the whole fleet or selected cars, set a booking window, minimum rental charge and optional maximum uses. The offer window is checked when a reservation is created. One offer applies per booking; the best eligible automatic offer is selected when no code is entered. Discounts apply to rental charges only, retain a minimum GH₵1 rental charge, and never discount the refundable deposit. Live payment holds reserve coupon capacity; unpaid expired holds release it. Existing booking prices and promotion snapshots remain unchanged when campaigns are edited.

Run `npm run test:promotions` with the app running to verify coupon capacity races, price snapshots, non-stacking, paused codes, automatic offers and access controls using disposable fixtures.

New users are CUSTOMER, and clients cannot choose roles. Create a normal account, then have the database owner assign one of ADMIN, MANAGER, AGENT, FLEET, FINANCE using `npm exec prisma studio` on a trusted local machine. There are no default admin passwords. `/admin` enforces authentication; writes check role and origin on the server. GPS is restricted to ADMIN, MANAGER, FLEET. Finance exports are restricted and audited.

## Mock GPS

`src/lib/gps.ts` defines a GpsProvider interface and returns simulated Accra coordinates. The staff UI and endpoint explicitly identify mock positions. Replace the adapter after the provider is selected; retain server-side permission checks and add stale/offline semantics based on real recorded timestamps.

## Validation

`npm test`, `npm run typecheck`, `npm run build`. With the app running, `npm run test:integration` tests authentication, concurrent reservations, expiry, staff permissions, maintenance, inspections and CSV export against temporary fixtures, then removes only those fixtures. Currency values use integers; partial rental days round up. Times are displayed in Africa/Accra. CSV neutralizes spreadsheet formula prefixes. Account cookies are managed by Better Auth.

## Before launch

This is a development implementation, not a production release. Replace sample fleet, images and rates with verified vehicle records. Approve terms/privacy/charges and operational contact information. Configure Paystack and test success, cancellation, replay, late payment, and refunds in its sandbox. Remaining guide scope includes notification delivery, document/evidence storage, staff MFA, rate histories/extras/discounts, turnaround buffers, cancellation/refund approval workflows, full customer administration, scheduled reconciliation, filtered reporting, monitoring, backups and restore drills. The GPS provider is deliberately mocked. No production deployment or live charge has been performed.

Keep `.env` private. Rotate the database password supplied in chat before production and replace the local secret accordingly. Deployment needs a supported Node hosting service, the same database environment, and an HTTPS Better Auth URL.

