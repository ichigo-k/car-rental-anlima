import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SectionHeading } from "@/components/marketing-sections";
import { Header, Footer } from "@/components/header";
import { FleetBrowser } from "@/components/fleet-browser";
import { Testimonials } from "@/components/testimonials";
import { publicReviews } from "@/lib/reviews";
import { VehicleCard } from "@/components/vehicle-card";
import { SearchForm } from "@/components/search-form";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import { publicPage } from "@/lib/seo";
export const metadata: Metadata = publicPage(
  "Cars for Rent in Accra",
  "Browse ANLIMA's rental cars in Accra: saloons, SUVs, pickups and executive cars, self-drive or with a driver. Check availability and daily rates online.",
  "/fleet",
);
export const dynamic = "force-dynamic";
export default async function Fleet({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  // Searches made before results had their own page.
  if (q.pickup || q.returnAt)
    redirect(`/search?${new URLSearchParams(q as Record<string, string>)}`);
  const cars = await db.vehicle.findMany({
    where: { status: "AVAILABLE" },
    orderBy: { dailyRate: "asc" },
  });
  const reviews = await publicReviews(db);
  const featured = await db.vehicle.findMany({
    where: { status: "AVAILABLE" },
    orderBy: { createdAt: "asc" },
    take: 4,
  });
  return (
    <>
      <section className="design-hero cars-hero">
        <Image
          className="design-hero-photo"
          src="/images/figma/cars-imgEnhanceThisImage2K20261006134800Photoroom1.png"
          alt="Toyota SUV ready for your journey"
          fill
          preload
          sizes="130vw"
        />
        <Header overlay active="Cars" />
        <div className="design-hero-copy">
          <h1>Find the Right Car for Your Journey</h1>
          <p>
            Explore our range of rental cars, from comfortable everyday vehicles
            to spacious SUVs and premium options. Compare vehicle features,
            check daily rental prices, and choose a car that suits your travel
            needs.
          </p>
          <Link className="button" href="#browse">
            Browse Our Cars
          </Link>
        </div>
      </section>
      <main>
        <section className="design-catalogue" id="browse">
          <div className="design-container">
            <SectionHeading eyebrow="OUR FLEET" title="Browse Our Cars">
              Explore our selection of vehicles and compare their features to
              find the right car for your journey.
            </SectionHeading>
            <div className="fleet-search-panel">
              <SearchForm initial={q} />
              <p>
                All times are in Ghana time (GMT). Pickup options depend on your
                selected car.
              </p>
            </div>
            <FleetBrowser
              key={q.category ?? ""}
              cars={cars}
              query=""
              initialCategory={q.category}
            />
          </div>
        </section>
        {featured.length > 0 && (
          <section className="design-featured">
            <div className="design-container">
              <SectionHeading eyebrow="OUR SELECTION" title="Featured Cars">
                Explore a selection of vehicles suited to different journeys,
                <br />
                from everyday city drives to family outings and premium travel.
                Compare your options and find the right car for your next trip.
              </SectionHeading>
              <div className="fleet-grid">
                {featured.map((car) => (
                  <VehicleCard car={car} detailed key={car.id} />
                ))}
              </div>
              <Link className="button" href="#browse">
                Explore All Cars
                <img
                  src="/images/figma/cars-imgVector.svg"
                  alt=""
                  width="14"
                  height="10.8338"
                />
              </Link>
            </div>
          </section>
        )}
        <section className="design-confidence">
          <Image
            className="confidence-background"
            src="/images/figma/cars-img4C3606E7252649Aa93C8863933Dd6000Copy1.png"
            alt=""
            fill
            sizes="100vw"
          />
          <Image
            className="confidence-car"
            src="/images/figma/cars-imgPngfindComCarFrontPng9499801.png"
            alt="White Audi TT RS seen from the front"
            width={1644}
            height={1255}
            sizes="(max-width: 760px) 100vw, 50vw"
          />
          <div>
            <p className="eyebrow">DRIVE WITH CONFIDENCE</p>
            <h2>The Right Car for Every Journey</h2>
            <p>
              From everyday city drives to family outings and business trips,
              explore a range of vehicles designed to suit different travel
              needs. Find an option that fits your plans and enjoy the freedom
              to travel your way.
            </p>
            <Link className="button light" href="#browse">
              Explore All Cars
            </Link>
          </div>
        </section>
        <Testimonials reviews={reviews} />
      </main>
      <Footer />
    </>
  );
}
