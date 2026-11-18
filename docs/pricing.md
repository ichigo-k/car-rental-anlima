# Pricing

Launch prices follow ANLIMA's "Accra Car Rental Market and Recommended Pricing" (15 November 2026). Review them every three months, as that document recommends.

## Where prices are set

- **Each car** (Cars & availability → Edit vehicle): self-drive daily rate, refundable deposit, driver service (self-drive only, self-drive or with an ANLIMA driver, or with a driver only), daily rate with driver, and optional mileage allowance and per-km charge.
- **Fees & settings** (administrators): longer-rental discounts, delivery and collection, additional authorised driver, driver overtime, late return, fuel, cleaning, smoking, default mileage, and cancellation terms.

## How a price is worked out

`priceRental` in `src/lib/pricing.ts` is the only price calculation; the booking form, quotes, bookings and the chat assistant all use it.

1. Days are counted in 24-hour periods from pickup, part days rounded up.
2. Rental = days × the car's daily rate (or its with-driver rate).
3. Longer-rental discount: 5% for 3–6 days, 10% for 7–13, 15% for 14–29, 20% for 30 or more (editable).
4. Any promotion applies to the rental after that discount.
5. Extras are added: delivery and collection, additional authorised driver.
6. The refundable deposit is added.

Each booking stores these lines (`BookingItem`), so its total never changes if prices are edited later.

## Charges after return

Late returns are charged per started hour after the grace period, at a percentage of the daily rate (10% to start), capped at one day's rate for each 24 hours. Fuel, mileage, cleaning and smoking charges follow Fees & settings and the car's own mileage rules. Staff approve or waive every charge.

## Fleet

`npx tsx scripts/load-anlima-fleet.ts` loads ANLIMA's six cars at the launch rates. It can be run again safely; it never deletes cars, and it makes the old sample cars inactive.

Values to confirm with ANLIMA: the RAV4 is priced as the older model (GH₵1,000/day); the Santa Fe is set to 5 seats; all cars are listed as automatic petrol; the Civic, Santa Fe, Frontier and Tundra need real photos (they show "Photo coming soon"); delivery and collection starts at GH₵150 within the GH₵100–250 range; the late fee starts at 10% of the daily rate per hour.
