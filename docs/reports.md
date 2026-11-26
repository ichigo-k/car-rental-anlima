# Reports

`/admin/reports` holds the operational reports from Guide §10, for administrators, managers and finance officers. Rules are in `src/lib/reports.ts`.

| Report | Filters | Shows |
| --- | --- | --- |
| Bookings | Pickup dates, status, category, car, customer | Each booking with its rental value, deposit and total; counts, rental value and rental days for bookings that went ahead |
| Payments | Dates, provider, verified or not | Each payment with refunds; gross received, refunded, refunds in progress and net |
| Fleet utilisation | Period (default: last 30 days), category, car | Per car: days in period, blocked, available, reserved and rented, and utilisation (rented plus reserved, over available) |
| Returns and charges | Return dates, category, car | Each return: hours late, charges approved, waived and awaiting, deposit used and returned, amount owed; approved charges by type |
| Customers | Booking dates, name, email or phone | Bookings, completed rentals, latest booking and amount paid less refunds; no ID or licence numbers |

Dates are whole days in Ghana time; the "to" date includes the whole day.

## Exports

**Export CSV** downloads the report with the same filters as the screen (Guide AC-09). The screen and the export are produced by the same function, so they always match. The file starts with the report name, when and by whom it was exported, and the filters; amounts are in cedis. Text that a spreadsheet could run as a formula is neutralised. Every export is recorded in the activity history with its filters and row count. Exports hold up to 10,000 rows; the screen shows the first 500.
