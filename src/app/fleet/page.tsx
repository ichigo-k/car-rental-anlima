import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "@/components/marketing-sections";
import { Header, Footer } from "@/components/header";
import { FleetBrowser } from "@/components/fleet-browser";
import { SearchForm } from "@/components/search-form";
import { db } from "@/lib/db";
import { quote, blockingWhere, overlaps } from "@/lib/pricing";
export const dynamic = "force-dynamic";
export default async function Fleet({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  let error = "";
  let interval = {};
  if (q.pickup || q.returnAt) {
    try {
      if (!q.pickup || !q.returnAt)
        throw new Error("Choose both a pickup and return date.");
      const start = new Date(q.pickup),
        end = new Date(q.returnAt);
      quote(start, end, 1, 0);
      if (start <= new Date()) throw new Error("Choose a future pickup date.");
      interval = {
        bookings: {
          none: { ...overlaps(start, end), ...blockingWhere(new Date()) },
        },
        blocks: { none: { start: { lt: end }, end: { gt: start } } },
      };
    } catch (e) {
      error = (e as Error).message;
    }
  }
  const cars = await db.vehicle.findMany({
    where: {
      status: "AVAILABLE",
      ...interval,
      ...(q.location ? { pickupPoints: { has: q.location } } : {}),
    },
    orderBy: { dailyRate: "asc" },
  });
  const query =
    !error && q.pickup && q.returnAt
      ? `?${new URLSearchParams({ pickup: q.pickup, returnAt: q.returnAt, ...(q.location ? { location: q.location } : {}) })}`
      : "";
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
      <main className="design-catalogue" id="browse">
        <div className="design-container">
          <SectionHeading eyebrow="OUR FLEET" title="Browse Our Cars">
            Explore our selection of vehicles and compare their features to find
            the right car for your journey.
          </SectionHeading>
          <div className="fleet-search-panel">
            <SearchForm initial={q} />
            <p>
              All times are in Ghana time (GMT). Pickup options depend on your
              selected car.
            </p>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <FleetBrowser
            key={`${query}:${q.category ?? ""}`}
            cars={cars}
            query={query}
            initialCategory={q.category}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
