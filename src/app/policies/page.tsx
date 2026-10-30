import { Header, Footer } from "@/components/header";
export default function Policies() {
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
            "Contact the rental team before changing dates or cancelling. Availability and price must be checked again. Cancellation deadlines, refund rules, and operational contact details are awaiting business approval.",
          ],
          [
            "Privacy and tracking",
            "We store your account, contact information, driver details, reservation, and payment reference to operate rentals. Ghana Card numbers are encrypted at rest and displayed masked. Staff check original identity and driving documents at pickup; entering a number does not verify it. Payment card information is handled by your selected payment provider, Paystack or Flutterwave. GPS is currently simulated; future tracking disclosure and retention rules must be approved before integration. Access to driver and tracking records is restricted to authorised staff.",
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
