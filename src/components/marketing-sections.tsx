import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="design-section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function RentalSteps() {
  return (
    <section className="design-steps" id="how-it-works">
      <SectionHeading eyebrow="HOW IT WORKS" title="Rent a Car in 3 Easy Steps">
        From choosing your vehicle to confirming your booking, ANLIMA makes
        renting a car simple and convenient.
      </SectionHeading>
      <div className="design-step-grid">
        {[
          [
            "Choose Your Car",
            "Explore our range of available vehicles, compare their features, seating capacity and daily rental prices, then choose the car that best suits your travel needs, destination and budget.",
          ],
          [
            "Book Your Ride",
            "Select your pickup location and rental dates, review your chosen vehicle and rental details, then complete the booking process and payment to secure your reservation.",
          ],
          [
            "Enjoy the Journey",
            "Once your booking is confirmed, follow the agreed pickup arrangements to collect your vehicle. Get ready to explore, attend to your plans or travel to your destination with ANLIMA.",
          ],
        ].map(([title, description], i) => (
          <article key={title}>
            <span className="design-step-number">{i + 1}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
export function RoadBanner() {
  return (
    <section className="design-road">
      <div>
        <h2>Ready to Hit the Road?</h2>
        <p>
          Your next journey starts with the right car. Explore our fleet, choose
          the vehicle that suits your needs, and book with confidence. ANLIMA
          makes it easy to find the right ride for your next trip.
        </p>
        <Link className="button gold" href="/fleet#browse">
          Book Your Car Today
        </Link>
      </div>
      <Image
        src="/images/figma/home-imgPngegg31.png"
        alt="Silver sedan ready for your next journey"
        width={1401}
        height={788}
        sizes="(max-width: 760px) 120vw, 100vw"
      />
    </section>
  );
}
export function Faq() {
  return (
    <section className="design-faq design-container" id="faqs">
      <div>
        <h2>
          Frequently Asked
          <br />
          Questions
        </h2>
        <p>
          Find answers to common questions about renting a car with ANLIMA, from
          booking requirements and vehicle availability to rental terms and
          pickup arrangements.
        </p>
      </div>
      <div className="faq-list">
        {[
          [
            "How do I book a car with ANLIMA?",
            "Choose a car and your dates, then sign in to add your contact and driver details. Review your quote and reserve. Complete payment within 15 minutes to confirm your car.",
          ],
          [
            "What documents do I need to rent a car?",
            "Have your valid driving licence and identification ready. Review the rental guide for the documents and eligibility requirements that apply to your booking.",
          ],
          [
            "How can I pay for my car rental?",
            "Review the full rental quote, then choose Paystack or Flutterwave and pay securely using an available card or Mobile Money option. Your booking page will show the payment and confirmation status.",
          ],
          [
            "Can I cancel or change my reservation?",
            "Reservation changes and cancellations are subject to ANLIMA’s rental terms and conditions. Review the applicable policy before changing an existing booking.",
          ],
          [
            "Where do I collect and return the vehicle?",
            "Select one of the pickup points configured for your chosen car. Your reservation shows the selected location and rental dates.",
          ],
          [
            "How can I check my reservation?",
            "Open My bookings to review your reservation, payment status and rental details. Sign in with the email address used for your booking.",
          ],
        ].map(([question, answer], i) => (
          <details key={question} open={i === 0}>
            <summary>
              {question}
              <span className="faq-toggle" aria-hidden="true" />
            </summary>
            <p>
              {answer}
              {i === 1 || i === 3 ? (
                <>
                  {" "}
                  <Link href="/policies">Read the rental guide.</Link>
                </>
              ) : null}
              {i === 5 ? (
                <>
                  {" "}
                  <Link href="/bookings">View my bookings.</Link>
                </>
              ) : null}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
