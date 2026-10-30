import Image from "next/image";
import { Poppins } from "next/font/google";
import Link from "next/link";
import { Header, Footer } from "@/components/header";
import { ArrowRight } from "@/components/icons";
import { SearchForm } from "@/components/search-form";
import { VehicleCard } from "@/components/vehicle-card";
import {
  Faq,
  RoadBanner,
  SectionHeading,
} from "@/components/marketing-sections";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
const heroFont = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
export default async function Home() {
  const fleet = await db.vehicle.findMany({
    where: { status: "AVAILABLE" },
    orderBy: { dailyRate: "asc" },
    take: 4,
  });
  return (
    <>
      <main className="figma-home">
        <section
          className={`design-hero home-hero restored-hero ${heroFont.className}`}
        >
          <Image
            className="design-hero-photo"
            src="/images/figma/home-imgEnhanceThisImage2K20261006134800Photoroom1.png"
            alt="Silver Mercedes SUV on an open road"
            fill
            preload
            sizes="(max-width: 760px) 180vw, 125vw"
          />
          <Header overlay active="Home" />
          <div className="design-hero-copy">
            <h1>Drive With Confidence.</h1>
            <p>
              Find the right vehicle for your journey with a straightforward
              booking experience from start to finish.
            </p>
            <Link href="/fleet#browse" className="button">
              BOOK A CAR
            </Link>
          </div>
          <div className="design-hero-search">
            <SearchForm />
          </div>
        </section>
        <section className="design-fleet design-container">
          <SectionHeading
            eyebrow="OUR FLEET"
            title="Find The Perfect Car For Your Journey"
          >
            Explore our selection of vehicles designed to make every journey
            comfortable, convenient and reliable.
          </SectionHeading>
          <div className="view-all">
            <Link href="/fleet">
              View All Cars <ArrowRight size={16} />
            </Link>
          </div>
          <div className="fleet-grid">
            {fleet.map((car) => (
              <VehicleCard car={car} key={car.id} />
            ))}
          </div>
          {!fleet.length && (
            <p className="empty">
              No cars are currently available. Please check back soon.
            </p>
          )}
        </section>
        <section className="design-benefits design-container" id="about">
          <SectionHeading
            eyebrow="WHY CHOOSE ANLIMA"
            title="Your Journey, Our Priority"
          >
            We make finding and booking your next rental car simple, with
            vehicle options for different journeys and travel needs.
          </SectionHeading>
          <div className="benefits-layout">
            <div className="benefits-car">
              <Image
                src="/images/figma/home-imgCar1.png"
                alt="White BMW SUV"
                fill
                sizes="(max-width: 760px) 100vw, 55vw"
              />
            </div>
            <div className="benefits-list">
              {[
                [
                  "home-imgLayer7.svg",
                  "Vehicle Options",
                  "Find a vehicle that suits your journey, from everyday travel to longer trips.",
                ],
                [
                  "home-imgLayer8.svg",
                  "Easy Booking",
                  "Search for available vehicles and submit your rental details through the website.",
                ],
                [
                  "home-imgGroup48.svg",
                  "Clear Rental Pricing",
                  "Review the rental price and applicable charges before completing your booking.",
                ],
                [
                  "home-imgLayer9.svg",
                  "Booking Assistance",
                  "Contact the ANLIMA team if you need help with a rental enquiry or booking.",
                ],
              ].map(([icon, title, description]) => (
                <article key={title}>
                  <span className="benefit-icon">
                    <img src={`/images/figma/${icon}`} alt="" />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <RoadBanner />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
