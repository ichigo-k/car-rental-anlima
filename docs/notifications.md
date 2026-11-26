# Email and SMS notifications

Booking messages go by email through **Resend** and by text message through **SMSOnlineGH** (Developer Guide §6). Staff see every message at `/admin/notifications` and can resend one that failed.

## What is sent

| Event | Customer | Operations |
| --- | --- | --- |
| Payment verified, booking confirmed | Email and SMS | Email |
| Payment received but needs staff review | Email and SMS | Email |
| Customer asks to cancel a paid booking | — | Email |
| Staff cancel a booking | Email and SMS | Email |
| Pickup within 24 hours | Email and SMS | — |
| Return within 3 hours | Email and SMS | — |
| Return more than 1 hour overdue | Email and SMS | Email |

Account messages go through the same outbox:

| Event | Message |
| --- | --- |
| Sign-up | Email with a link to confirm the address (valid 24 hours) |
| Customer confirms a mobile number | SMS with a 6-digit code (valid 5 minutes, 5 tries) |
| Forgot password | Email with a reset link (valid 1 hour) or SMS with a reset code (valid 5 minutes) |

Customers must confirm both their email and mobile number at `/account/verify` before they can book, and bookings use the confirmed number. Codes and links are removed from the database once sent, and expire unsent after 30 minutes, so staff never see them. A password reset signs the account out everywhere.

Wording lives in `src/lib/notify/templates.ts` (booking messages) and `src/lib/auth.ts` (account messages). Customer numbers are converted to the international form SMSOnlineGH expects (`024 123 4567` → `233241234567`).

## How delivery works

Messages are written to the `Notification` table in the same transaction as the event, then sent after the response finishes. A message that cannot be sent never affects the booking. Failed sends are retried with increasing delays and marked **Failed** after 5 attempts. Each message has a unique key, so an event or reminder is never sent twice, and Resend receives an idempotency key so a retry cannot send a duplicate email.

Until a provider's keys are set, its messages wait in the queue (no attempts are used) and are sent automatically once the keys are added.

## Connect the providers

Add to the server environment (`.env` locally). Do not commit these or paste them into chat.

```
RESEND_API_KEY=            # from resend.com → API Keys
EMAIL_FROM=                # e.g. ANLIMA Car Rental <bookings@your-domain>; the domain must be verified in Resend
EMAIL_REPLY_TO=            # optional
OPERATIONS_EMAIL=          # the ANLIMA inbox that receives staff alerts

SMSONLINEGH_API_KEY=       # from the SMSOnlineGH account
SMSONLINEGH_SENDER=        # a sender name already approved under SMS Messaging in that account

CRON_SECRET=               # a long random string, at least 16 characters
```

## Schedule the reminders

Reminders and retries run from `GET /api/cron/notifications`, which must be called every 10 to 15 minutes with the header `Authorization: Bearer <CRON_SECRET>`. On Vercel, add a cron job for that path (Vercel sends the secret automatically when `CRON_SECRET` is set); elsewhere, any scheduler that can make an HTTP request works. Without the scheduler, confirmation and cancellation messages still send straight away, but reminders and retries do not.

## Tests

`npm run test:notifications` checks the outbox against local stand-ins for both providers; nothing reaches Resend or SMSOnlineGH. The SMSOnlineGH error code list is not published, so every SMS failure is retried; check the message's error on the Notifications page if one fails.
