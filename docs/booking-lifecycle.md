# Booking lifecycle

Statuses follow the Developer Guide §5 and §7. Rules live in `src/lib/booking-lifecycle.ts`.

| Status | Meaning | Next |
| --- | --- | --- |
| `PENDING_PAYMENT` | 15-minute payment hold | `CONFIRMED`, `PAYMENT_REVIEW`, `CANCELLED` |
| `PAYMENT_REVIEW` | Verified payment that staff must resolve | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | Paid; vehicle reserved | `CHECKED_OUT`, `CANCELLED`, `NO_SHOW` |
| `CHECKED_OUT` | Vehicle handed over | `RETURNED` |
| `RETURNED` | Vehicle back; charges and deposit still open | `CLOSED` |
| `NO_SHOW` | Customer did not collect | `CLOSED` |
| `CLOSED` | Charges decided and deposit settled | — |
| `CANCELLED` | Cancelled before pickup | — |

`EXPIRED` is not stored: it is a `PENDING_PAYMENT` booking whose hold has passed.

## Who can do what

- Agents, managers and admins record handover and return, cancel, mark no-shows and propose charges.
- Finance, managers and admins approve or waive charges and close rentals.
- Customers cancel unpaid holds themselves. For a confirmed booking they send a cancellation request, which appears on the admin dashboard; staff apply the cancellation policy and cancel.

## Charges and deposit

Late, fuel, cleaning, smoking, damage, mileage and other charges need a reason and may carry an evidence reference.

Administrators set the fee schedule at `/admin/settings` (rules in `src/lib/fees.ts`). When a return is recorded, the system proposes late, fuel-shortage and excess-mileage charges from it; the cleaning and smoking fees pre-fill the charge form. Until a schedule is saved, only late returns are charged (one daily rate per started day after a 60-minute grace period). Every fee change is recorded in the activity history.

When staff cancel a paid booking, the cancellation form shows the refund due under the saved cancellation window and percentage. The deposit is always refundable.

A rental closes only when no charge is awaiting a decision. Approved charges are taken from the deposit first; the rest of the deposit is refunded, and any excess is shown as owed by the customer. Refund payments themselves are recorded separately.

## Migration note

`202611140001_booking_lifecycle` renames `ACTIVE` to `CHECKED_OUT`. Rentals that were `COMPLETED` before this release were settled outside the system, so they move straight to `CLOSED`.
