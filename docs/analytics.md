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

## Website analytics page

Administrators, managers and finance officers see the figures in the dashboard at **Website analytics** (`/admin/analytics`), for the last 7, 30 or 90 days:

- **Totals:** visitors, page views, the share who left after one page and the average visit, each with the change on the previous period. Searches, bookings made and payments verified sit beside them; the last two come from ANLIMA's own records.
- **Visits per day,** with a table view.
- **Booking funnel:** visitors, then car views, started payments and confirmed bookings, with the share that went on at each step.
- **Rankings:** top pages, where visitors came from, countries and devices.

To switch it on, create an API key in Umami (**Settings → API keys**) and add it to the server's `.env` as `UMAMI_API_KEY=...`, then run the update. The key stays on the server. Figures are cached for five minutes, which keeps well within Umami's limit of 50 requests per 15 seconds. If Umami cannot be reached, the page says so and still shows ANLIMA's own figures.
