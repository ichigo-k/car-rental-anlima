import type { Metadata } from "next";
import Image from "next/image";
import { Footer } from "@/components/header";
import { MarketingHero, MarketingCta } from "@/components/anlima-pages";
import { SectionHeading } from "@/components/marketing-sections";
export const metadata: Metadata = { title: "How It Works" };
const steps = [
  [
    "Find Your Perfect Ride",
    "Start by exploring our available vehicles and comparing the options that suit your needs. Whether you need an everyday car for city travel, a spacious SUV for a family trip or a more premium ride for a special occasion, you can review the available options, check the features and daily rates, and choose the vehicle that works best for your plans and budget.",
    "48",
    "A rental car ready for its next journey",
  ],
  [
    "Reserve Your Vehicle with Ease",
    "Once you have found your preferred vehicle, enter your pickup and return details, including your chosen dates and times. Complete the required booking information and submit your reservation. Your car is held for 15 minutes while you complete payment.",
    "51",
    "Customer choosing a rental car online",
  ],
  [
    "Get Your Booking Confirmed",
    "Complete payment within your reservation window. Your reservation is confirmed after payment has been verified. View your booking and pickup arrangements in My bookings, and bring your original identification and valid driving licence when collecting your car.",
    "52",
    "Customer receiving the keys to a rental car",
  ],
];
export default function HowItWorksPage() {
  return (
    <>
      <main className="anlima-marketing-page">
        <MarketingHero page="how" />
        <section className="anlima-timeline">
          <div className="design-container">
            <SectionHeading
              eyebrow="HOW IT WORKS"
              title="Renting a Car Is Easy"
            >
              From choosing your car to hitting the road, our simple booking
              process makes getting started quick and convenient.
            </SectionHeading>
            <ol>
              {steps.map(([title, copy, image, alt], i) => (
                <li key={title}>
                  <div className="anlima-step-copy">
                    <h3>{title}</h3>
                    <p>{copy}</p>
                    <img
                      className="step-dots"
                      src="/images/figma/Group143.svg"
                      alt=""
                    />
                  </div>
                  <div className="anlima-step-marker">
                    <span>STEP</span>
                    <strong>0{i + 1}</strong>
                    <img src="/images/figma/Group144.svg" alt="" />
                  </div>
                  <img
                    className="anlima-step-photo"
                    src={`/images/figma/how-Ellipse${image}.png`}
                    width="350"
                    height="350"
                    alt={alt}
                  />
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="anlima-before-book">
          <SectionHeading
            eyebrow="BEFORE YOU BOOK"
            title="A Few Things to Know Before You Go"
          >
            Get familiar with the details that help you prepare for your rental,
            from booking confirmation to pickup arrangements, so you know what
            to expect before your journey begins.
          </SectionHeading>
          <div className="anlima-before-inner design-container">
            <ol>
              {[
                [
                  "Booking Confirmation",
                  "Your reservation is confirmed only after your booking details have been reviewed and your payment has been verified.",
                ],
                [
                  "Pickup Arrangements",
                  "Review your confirmed pickup date, time and location so you know where to collect your vehicle.",
                ],
                [
                  "Rental Information",
                  "Check your rental terms, payment details and any documents required before collecting your vehicle.",
                ],
              ].map(([title, copy], i) => (
                <li key={title}>
                  <span>{i + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div>
              <Image
                src="/images/figma/how-Pngegg61.png"
                alt="Black rental car"
                fill
                sizes="(max-width: 760px) 100vw, 60vw"
              />
            </div>
          </div>
        </section>
        <MarketingCta variant="how" />
      </main>
      <Footer />
    </>
  );
}
