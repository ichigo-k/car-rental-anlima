import { Header, Footer } from "@/components/header";
import type { Metadata } from "next";
import { publicPage } from "@/lib/seo";
import { db } from "@/lib/db";
import { getFees } from "@/lib/fees";
export const metadata: Metadata = publicPage(
  "Rental Guide and Policies",
  "ANLIMA's rental terms: licences, deposits, fuel, mileage, late returns, cancellations, privacy and vehicle tracking.",
  "/policies",
);
// Cancellation terms come from Fees & settings, so the page is rendered live.
export const dynamic = "force-dynamic";
export default async function Policies() {
  const fees = await getFees(db);
  const freeHours = fees.freeCancellationHours;
  return (
    <>
      <Header />
      <main className="section prose">
        <p className="eyebrow">RENTAL GUIDE</p>
        <h1>
          Clear expectations.
          <br />
          Confident journeys.
        </h1>
        <p className="notice">
          Draft policies · version 2026-10-draft. These development terms need
          ANLIMA approval before live rentals.
        </p>
        {[
          [
            "Before you drive",
            "Bring your valid driving licence and identification. Your licence must remain valid throughout the rental. Only authorised drivers may drive the vehicle. Staff will verify documents at pickup.",
          ],
          [
            "Rates and charges",
            "A daily rate covers up to 24 hours from the agreed pickup time. Fuel is not included: return the car at the agreed fuel level. A refundable security deposit is required before handover. Rentals of 3 days or more are discounted automatically. Mileage allowances and travel areas are stated in your quote; travel outside Accra, commercial site work and poor-road use need prior approval and may be priced separately. Rates may rise during peak periods, major events and holidays. Premium vehicles such as the Mercedes-Benz and Toyota Tundra need stricter verification and a higher deposit. All rates depend on availability and the final signed rental agreement.",
          ],
          [
            "Booking and payment",
            "Daily rentals round partial days up. The quote separates rental charges and a refundable security deposit. A payment hold lasts 15 minutes. Reservations are confirmed only after server-side payment verification and a final availability check.",
          ],
          [
            "Looking after your vehicle",
            "Wear seat belts. No smoking, hazardous items, or unauthorised travel. Return the vehicle clean, with the agreed fuel level. Report accidents, damage, or breakdowns promptly to the rental team.",
          ],
          [
            "Pickup and return",
            "Staff record mileage, fuel, condition, and acknowledgement at handover and return. Deposit refunds and any damage, fuel, cleaning, or late charges require staff review under the final approved charge schedule.",
          ],
          [
            "Changes and cancellations",
            `To change your dates or car, contact the rental team. They check availability before making any change and confirm the new details by email and SMS. If the new booking costs more, the difference is settled at return; if it costs less, the difference is refunded. You can cancel free of charge up to ${freeHours} hour${freeHours === 1 ? "" : "s"} before pickup.${fees.lateCancellationPercent > 0 ? ` After that, ${fees.lateCancellationPercent}% of the rental charge is kept.` : ""} The refundable deposit is always returned in full when you cancel, and refunds go back to the payment method you used.`,
          ],
          [
            "Privacy",
            "We store your account, contact details, driver details, bookings and payment references to run your rental, and keep a record of the emails and text messages we send you. Ghana Card numbers are encrypted and shown masked. Staff check your original identity and driving documents at pickup; entering a number online does not verify it. Card and Mobile Money details are handled by Paystack or Flutterwave; ANLIMA never sees them. Only authorised staff can see customer and driver records.",
          ],
          [
            "Vehicle tracking",
            "ANLIMA vehicles are fitted with GPS trackers. While you rent a car, its location, speed, direction and ignition status are recorded. We use this to locate and recover vehicles, confirm handover and return, respond to breakdowns and emergencies, and investigate breaches of the rental terms. Only authorised fleet staff can see vehicle locations and route history, and every view is logged. Locations are never shown on customer pages or used for marketing.",
          ],
        ].map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
      </main>
      <Footer />
    </>
  );
}
