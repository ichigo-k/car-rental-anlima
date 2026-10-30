# Payment setup

ANLIMA uses hosted checkout with Paystack and Flutterwave v3. Card data and Mobile Money authorisation stay with the chosen provider; this app never collects card numbers, CVVs or wallet PINs.

## Environment

Set these server-only variables in `.env` or your deployment environment:

```dotenv
BETTER_AUTH_URL=https://YOUR_DOMAIN
PAYSTACK_SECRET_KEY=your-paystack-test-secret
FLUTTERWAVE_SECRET_KEY=your-flutterwave-test-secret
FLUTTERWAVE_WEBHOOK_SECRET=your-flutterwave-webhook-secret-hash
```

Restart the app after changing keys. Do not prefix these secrets with `NEXT_PUBLIC_`. Hosted checkout does not require public keys or Flutterwave card-encryption keys.

## Paystack

1. Use a Ghana merchant account and enable Card and Mobile Money in its payment settings.
2. Start with a test secret key from the Paystack dashboard.
3. Register `https://YOUR_DOMAIN/api/webhooks/paystack` as the webhook URL in the matching test/live environment.
4. The app passes `https://YOUR_DOMAIN/api/payments/callback` during checkout initialisation.

Amounts are sent as integer pesewas. The webhook validates `x-paystack-signature` using HMAC SHA512 over the exact raw request body, then re-verifies the transaction with Paystack.

Official references: [initialise/verify transactions](https://paystack.com/docs/api/transaction/), [Ghana Mobile Money](https://paystack.com/docs/payments/payment-channels/), [webhooks](https://paystack.com/docs/payments/webhooks/).

## Flutterwave v3

1. Use a Ghana-enabled merchant account and enable card and Ghana Mobile Money payment methods.
2. Put the Flutterwave test secret key in `FLUTTERWAVE_SECRET_KEY`.
3. Set a long random Secret Hash in Flutterwave's v3 webhook settings and put the identical value in `FLUTTERWAVE_WEBHOOK_SECRET`.
4. Register `https://YOUR_DOMAIN/api/webhooks/flutterwave` and enable successful payment events and retries.
5. The checkout return URL is `https://YOUR_DOMAIN/api/payments/flutterwave/callback`.

The Standard API receives GHS major-unit amounts (for example GH₵1,224.56 is `"1224.56"`, while Paystack receives `122456`). The app supplies `card,mobilemoneyghana` and the reservation's expiry time. Flutterwave account-level payment preferences can override checkout options; check the merchant dashboard settings.

The v3 webhook checks `verif-hash` against the configured Secret Hash in constant time. It then re-fetches the transaction by ID and checks its reference, currency, exact amount and successful status. The manual status check uses Flutterwave's verify-by-reference endpoint.

Official references: [Standard hosted checkout](https://developer.flutterwave.com/docs/flutterwave-standard-1), [Ghana payment methods](https://developer.flutterwave.com/docs/payment-methods), [webhooks](https://developer.flutterwave.com/docs/webhooks), [verification](https://developer.flutterwave.com/docs/transaction-verification).

## Confirmation and exceptions

- The server charges the stored reservation total, including its saved discount and refundable deposit. Browser-submitted amounts are ignored.
- Customers can manually check an already-completed payment without starting a second checkout. There is no automatic page-refresh loop.
- Webhook redelivery and callback/webhook races do not duplicate confirmation or its audit entry.
- A payment received after a pending hold expires, or while its car is unavailable, does not falsely confirm a rental. Staff review the PAYMENT_REVIEW reservation.
- A second charge against a confirmed, active or completed rental is marked SUCCESS_REVIEW. The rental keeps its operational status so its car is not released accidentally. Staff arrange any refund in the provider dashboard.
- A successful callback alone is not trusted; it always triggers provider API verification.
- Unknown references from a shared provider account are ignored after webhook authentication. Invalid signatures are rejected.
- Finance staff see the provider, payment attempts and verification/review status under Admin → Payments & reports. Setup cards indicate whether environment keys are present, not whether merchant onboarding is approved.

## Validation before accepting real payments

`npm test` covers exact currency conversion, signatures and provider matching. `npm run test:payments` uses mocked provider responses against temporary database fixtures; it does not make financial transactions.

After adding real test keys, use each provider's official test checkout to verify card success, Mobile Money success/pending, cancellation, failed payments, webhook retries, expiry and duplicate callbacks. Webhooks need a reachable public HTTPS domain; localhost alone cannot receive provider callbacks. Test and live dashboard settings are separate. Live activation requires approved merchant accounts and live keys. No live payment or refund has been performed by this implementation.
