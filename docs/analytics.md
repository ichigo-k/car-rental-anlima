# Analytics

Guide §10: privacy-conscious traffic and booking-funnel analytics. The site uses [Umami](https://umami.is), which sets no cookies and collects no personal data, so no cookie banner is needed. Code: `src/components/analytics.tsx` and `src/lib/analytics.ts`.

## What is counted

- **Page views** of public pages only. Account, bookings, sign-in and staff pages are never counted.
- **Funnel events:**

| Event | When | Details sent |
| --- | --- | --- |
| `search` | The search box is used | Car type and pickup location |
| `car-viewed` | A car's page is opened | Car and category |
| `checkout-started` | A customer chooses to pay | Payment provider |
| `booking-confirmed` | A payment is verified | Car and number of days |

- **Never sent:** names, emails, phone numbers, booking references, amounts or payment details. Addresses and referrers are sent without query strings, which can hold tokens or references.
- **Live site only:** only `anlimacarrental.com` is counted, and visitors with Do Not Track switched on are not counted.

## Switching it on

1. Create a free account at [cloud.umami.is](https://cloud.umami.is) and add the website `anlimacarrental.com`.
2. Copy its **Website ID** into the server's `.env` as `NEXT_PUBLIC_UMAMI_WEBSITE_ID=...`.
3. Run `bash /var/www/anlima/deploy/update.sh`. `NEXT_PUBLIC_` settings are built into the site, so a restart alone is not enough.

In Umami, the four events form the booking funnel (Events and Funnels reports).

To self-host Umami later (for example on the VPS with Docker), also set `NEXT_PUBLIC_UMAMI_SCRIPT_URL` to your Umami's `script.js` address. Without a Website ID, nothing loads.
