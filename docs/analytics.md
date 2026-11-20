# Analytics

Guide §10: privacy-conscious traffic and booking-funnel analytics. The site counts its own visits: no outside service, no cookies, and no personal data, so no cookie banner is needed. Code: `src/lib/site-analytics.ts`, `src/components/analytics.tsx` and `src/app/api/collect/route.ts`.

## What is counted

- **Page views** of public pages only. Account, bookings, sign-in and staff pages are never counted.
- **Funnel events:**

| Event | When | Details kept |
| --- | --- | --- |
| `search` | The search box is used | Car type and pickup location |
| `car-viewed` | A car's page is opened | Car and category |
| `checkout-started` | A customer chooses to pay | Payment provider |
| `booking-confirmed` | A payment is verified | Car and number of days |

- **Also kept:** the page path without query strings, the referring website's name (for example `google.com`) on the first page of a visit, and the device type (mobile, tablet, desktop).

## Privacy

- **Visitor codes:** visits are told apart by a code made from the day, the visitor's IP address and browser, and a server secret. The IP address and browser details are never stored. The code changes every day, so nobody can be identified or followed from one day to the next. A "visit" is therefore one person on one day.
- **Never stored:** names, emails, phone numbers, booking references, amounts or payment details.
- **Not counted:** visitors whose browser sends Do Not Track or Global Privacy Control, and bots and link-preview robots.
- **Limits and retention:** each visitor is limited to 300 events an hour, and events older than 13 months are deleted by the scheduled job.
- **Live site only:** the development app never records, because it shares the live database. Setting `ANALYTICS_IN_DEV=1` overrides this for testing.

## Website analytics page

Administrators, managers and finance officers see the figures in the dashboard at **Website analytics** (`/admin/analytics`), for the last 7, 30 or 90 days:

- **Totals:** visits, page views, the share that left after one page and the average visit, each with the change on the previous period. Searches, bookings made and payments verified sit beside them; the last two come from ANLIMA's bookings and payments.
- **Visits per day,** with a table view.
- **Booking funnel:** visits, then car views, started payments and confirmed bookings, with the share that went on at each step.
- **Rankings:** top pages, where visitors came from, and devices.

Nothing needs setting up: counting starts once the update is live.
