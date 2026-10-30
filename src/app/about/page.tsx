import type { Metadata } from "next";
import Image from "next/image";
import { Footer } from "@/components/header";
import { MarketingHero, MarketingCta } from "@/components/anlima-pages";
import { SectionHeading } from "@/components/marketing-sections";
export const metadata: Metadata = { title: "About Us" };
const values = [
  [
    "Integrity",
    "We believe in honesty, transparency and doing what is right in every interaction.",
  ],
  [
    "Customer Focus",
    "We put customers at the heart of our decisions and strive to understand their different travel needs.",
  ],
  [
    "Excellence",
    "We value quality, attention to detail and continuous improvement in everything we do.",
  ],
  [
    "Innovation",
    "We embrace better ideas and practical solutions that make the car rental experience simpler and more convenient.",
  ],
  [
    "Reliability",
    "We recognise the importance of dependable service and clear communication when customers plan their journeys.",
  ],
  [
    "Respect",
    "We value every customer, partner and team member, treating people with professionalism and consideration.",
  ],
];
export default function AboutPage() {
  return (
    <>
      <main className="anlima-marketing-page">
        <MarketingHero page="about" />
        <section className="anlima-story">
          <div className="anlima-story-inner">
            <div>
              <p className="eyebrow">GET TO KNOW ANLIMA</p>
              <h2>Your Journey, Our Priority</h2>
              <p>
                ANLIMA Car Rental is designed to make finding and booking a
                vehicle simpler, more convenient and more accessible. Whether
                you need a car for everyday travel, a business engagement, a
                family outing or a special occasion, our platform helps you
                explore available vehicles and find an option that suits your
                journey.
              </p>
              <p>
                From browsing our fleet and comparing vehicle options to
                submitting your booking details, ANLIMA brings the essential
                steps of the car rental process together in one place. We aim to
                give customers a clearer view of their options and a more
                straightforward way to arrange their travel, with an experience
                built around convenience, transparency and confidence from the
                moment they begin their search.
              </p>
            </div>
            <div className="anlima-story-photo">
              <Image
                src="/images/figma/about-Rectangle22.png"
                alt="Rental adviser handing a car over to a customer"
                fill
                sizes="(max-width: 760px) 100vw, 50vw"
              />
            </div>
          </div>
        </section>
        <section className="anlima-purpose design-container">
          <SectionHeading
            eyebrow="OUR MISSION & VISION"
            title="Driven by Purpose, Focused on You"
          >
            At ANLIMA, we believe renting a car should be a straightforward and
            convenient experience. Our mission and vision guide our commitment
            to simplifying the way people find vehicles, arrange bookings and
            plan their journeys with confidence.
          </SectionHeading>
          <div className="anlima-purpose-grid">
            <article>
              <img src="/images/figma/about-Layer7.svg" alt="" />
              <h3>Our Mission</h3>
              <p>
                To simplify the car rental process by connecting customers with
                available vehicle options through a convenient and accessible
                platform. ANLIMA aims to make it easier for people to explore
                their choices, submit booking requests and plan their journeys
                with greater confidence.
              </p>
            </article>
            <article>
              <img src="/images/figma/about-Layer8.svg" alt="" />
              <h3>Our Vision</h3>
              <p>
                To become a trusted choice for convenient car rental services,
                creating a smoother way for individuals and businesses to find
                suitable vehicles and make travel arrangements for different
                needs and occasions.
              </p>
            </article>
          </div>
        </section>
        <section className="anlima-values">
          <Image
            src="/images/figma/about-GenerateBackgroundWithoutInfo10F564Fa2K1.png"
            alt=""
            fill
            sizes="100vw"
          />
          <div className="design-container">
            <p className="eyebrow">OUR CORE VALUES</p>
            <h2>The Values That Drive Us</h2>
            <p className="anlima-values-intro">
              Our values shape how we approach our work, serve our customers and
              build lasting relationships. They reflect our commitment to
              creating a dependable, convenient and customer-focused car rental
              experience.
            </p>
            <div className="anlima-values-grid">
              {values.map(([title, copy], i) => (
                <article key={title}>
                  <span>
                    <img src={`/images/figma/about-Layer${i + 1}.svg`} alt="" />
                  </span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <MarketingCta />
      </main>
      <Footer />
    </>
  );
}
