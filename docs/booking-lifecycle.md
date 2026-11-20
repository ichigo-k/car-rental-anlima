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

- Agents, managers and admins record handover and return, change bookings, cancel, mark no-shows and propose charges.
- Finance, managers and admins approve or waive charges and close rentals.
- Customers cancel unpaid holds themselves. For a confirmed booking they send a cancellation request, which appears on the admin dashboard; staff apply the cancellation policy and cancel.

## Handover and return photos

Every handover and return needs at least one photo, up to 20 (Guide §7). Staff add them in the inspection form; on a phone the picker offers the camera. Each photo is resized on the device to at most 1600 pixels before upload, which keeps uploads small on mobile data and strips hidden metadata such as the phone's location.

- **Upload:** photos upload as they are added and join the inspection when it is saved. The server checks each file really is a JPEG, PNG or WebP image of 5 MB or less, from its content rather than its name. Photos of a saved inspection cannot be removed.
- **Viewing:** photos appear in the booking's inspection history. Only staff who can see bookings can open them; they are never in a public folder.
- **Timestamps:** each photo shows when it was uploaded. If the phone says it was taken more than ten minutes earlier, both times are shown, so an old gallery photo stands out.
- **Storage:** files are kept on the server's disk in `UPLOAD_DIR` (default `storage/uploads` in the app folder, which deploys keep), not in the database. Include this folder in backups.
- **Clean-up:** photos uploaded for an inspection that was never saved are deleted after a day by the scheduled job (`/api/cron/notifications`).

## Changing a booking

Staff can move a confirmed booking to other dates or another car, and change the return time of a car already on the road (Guide AC-05). The rules are in `src/lib/booking-change.ts`.

- **Check first:** the form checks availability and shows the price difference before anything is saved. Availability uses the same rule as customer bookings (other bookings holding the car and maintenance blocks), ignoring the booking being changed, with the car's row locked.
- **The amount paid never changes.** The difference is the rental price of the new arrangement (same driver option, extras and any promotion discount already given) minus the old one:
  - **More:** staff can add the difference as a "Booking change" charge, approved and settled at return like other charges.
  - **Less:** the credit owed to the customer is recorded on the change.
- **Records:** every change needs a reason. It is stored in its own history (before and after, who, why, price difference), shown on the booking, and added to the activity history. The customer gets an email and SMS with the new details.

## Charges and deposit

Late, fuel, cleaning, smoking, damage, mileage and other charges need a reason and may carry an evidence reference.

Administrators set the fee schedule at `/admin/settings` (rules in `src/lib/fees.ts`). When a return is recorded, the system proposes late, fuel-shortage and excess-mileage charges from it; the cleaning and smoking fees pre-fill the charge form. Until a schedule is saved, only late returns are charged (one daily rate per started day after a 60-minute grace period). Every fee change is recorded in the activity history.

When staff cancel a paid booking, the cancellation form shows the refund due under the saved cancellation window and percentage. The deposit is always refundable.

A rental closes only when no charge is awaiting a decision. Approved charges are taken from the deposit first; the rest of the deposit is refunded, and any excess is shown as owed by the customer. Refund payments themselves are recorded separately.

## Migration note

`202611140001_booking_lifecycle` renames `ACTIVE` to `CHECKED_OUT`. Rentals that were `COMPLETED` before this release were settled outside the system, so they move straight to `CLOSED`.
