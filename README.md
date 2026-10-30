# ANLIMA Car Rental

A car rental website for ANLIMA in Accra. Customers can browse cars, save favourites, reserve a vehicle and pay online. Staff manage the fleet, bookings, enquiries and promotions from `/admin`.

Built with Next.js, TypeScript, PostgreSQL, Prisma and Better Auth.

## Run locally

You need Node.js 22 or newer and a PostgreSQL database.

```sh
npm install
cp .env.example .env
```

Fill in `DATABASE_URL`, `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` in `.env`. For local development, the app URL is `http://localhost:3000`.

You can generate an auth secret with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Then set up the database and start the app:

```sh
npm run db:generate
npm run db:migrate
npm run dev
```

Open [localhost:3000](http://localhost:3000). To add the four sample cars, run `npm run db:seed`. The seed leaves existing cars alone and does not create staff accounts.

## Accounts and admin access

Email and password sign-in works without any OAuth keys. Google and Facebook are optional; add their credentials from `.env.example` to enable them. Their callback URLs are:

- `/api/auth/callback/google`
- `/api/auth/callback/facebook`

Register those paths on your app's domain in each provider's dashboard.

New accounts have the `CUSTOMER` role. To create an admin, sign up normally, open `npm exec prisma studio`, and change that user's role to `ADMIN`. Other staff roles are `MANAGER`, `AGENT`, `FLEET` and `FINANCE`. Sign in again after changing a role.

Staff sign-in goes to `/admin`; customers return to their booking or account page. Staff access is checked on the server.

## Reservations and payments

A reservation holds a car for 15 minutes. The customer chooses one of that car's pickup points and completes payment through Paystack or Flutterwave. The booking is confirmed after server verification and an availability check.

Payment options stay disabled until their keys are configured. Start with test keys. The [payment setup guide](docs/payments.md) covers the environment variables, webhooks and test flow for both providers.

Late payments and duplicate charges go to staff review. Refunds are handled in the payment provider's dashboard.

Promotions can apply automatically or use a coupon code. They can cover the whole fleet or selected cars. Discounts apply to the rental charge, not the refundable deposit.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

The integration tests use temporary records in your configured database and remove them afterwards:

| Command | Covers | App running? |
| --- | --- | --- |
| `npm run test:integration` | Accounts, reservations and staff operations | Yes |
| `npm run test:promotions` | Offers, coupon limits and saved prices | Yes |
| `npm run test:contact` | Enquiries and access controls | Yes |
| `npm run test:payments` | Checkout, webhooks and payment verification | No |

The payment tests mock provider responses. They do not charge a card or Mobile Money wallet. Testing actual hosted checkout needs provider test keys and a public webhook URL.

## Current limits

The sample fleet and contact placeholders need replacing with ANLIMA's actual details. GPS tracking is simulated. Refunds and customer notifications are not automated, and the rental terms are still a draft.

Keep `.env` out of Git. Set a stable `IDENTITY_ENCRYPTION_SECRET` before storing real Ghana Card records; changing encryption secrets later requires migrating those records. Use an HTTPS `BETTER_AUTH_URL` when deploying.
