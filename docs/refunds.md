# Refunds

Finance officers, managers and administrators refund payments from `/admin/payments` (Guide §5). The money goes back through the provider that took the payment, to the customer's card or Mobile Money wallet. Rules are in `src/lib/refunds.ts`.

## Sending a refund

- Only verified payments can be refunded, in part or in full, up to the amount not already refunded.
- The form suggests an amount from the booking:
  - **Cancelled booking:** what is due under the cancellation policy.
  - **Closed rental:** the deposit left after approved charges.
- Every refund needs a reason and a confirmation. It is recorded before the provider is asked, and each step is in the activity history.
- Once the provider accepts it, the customer gets an email and SMS saying the refund has started and usually arrives within 3 to 15 working days.
- The original payment record is never changed; refunds are kept as their own records against it.

## Statuses

| Status | Meaning |
| --- | --- |
| Sending… | Recorded; the request to the provider is in flight. |
| In progress | Accepted by the provider and being paid out. |
| Refunded | Completed by the provider. |
| Not sent | The provider declined it, or staff confirmed it was never sent. It does not count against the payment. |
| Check with provider | The provider's answer was lost (timeout or server error), so it is unknown whether the money went out. |

**Check with provider** blocks further refunds on that payment, so a lost answer can never lead to a second refund. Find the refund in the provider's dashboard, then press **It was sent** (with the provider's refund ID if shown) or **It was not sent**.

## Status updates

Refunds in progress are checked with the provider by the scheduled job (`/api/cron/notifications`), when staff press **Check status**, and whenever Paystack sends a refund webhook event. The webhook only prompts that check; its contents are not trusted for the outcome.

- **Paystack:** `POST /refund` with the transaction reference and the amount in pesewas; status from `GET /refund/{id}` (`processed` is complete, `failed` is not sent).
- **Flutterwave:** the transaction ID is looked up from our reference, then `POST /v3/transactions/{id}/refund` with the amount in cedis; status from `GET /v3/refunds/{id}`. `completed` means accepted and awaiting payout; `completed-momo`, `completed-bank-transfer` and similar mean paid out.

## Before going live

The provider calls follow Paystack's and Flutterwave's published refund APIs, but their exact responses could not be read from the official reference pages while building this. `npm run test:payments` checks the logic against stand-ins. Before live payments, issue one small refund for each provider in **test mode** and confirm it moves to Refunded.
