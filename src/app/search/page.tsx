import Link from "next/link";
import type { Metadata } from "next";
import { Header, Footer } from "@/components/header";
import { FleetBrowser } from "@/components/fleet-browser";
import { SearchForm } from "@/components/search-form";
import { searchCars } from "@/lib/car-search";
import { privatePage } from "@/lib/seo";
// Search results get their own page: each search is different, so it stays
// out of search engines.
export const metadata: Metadata = privatePage("Available cars");
export const dynamic = "force-dynamic";
const when = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    timeZone: "Africa/Accra",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export default async function Search({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  const { error, cars, query } = await searchCars(q);
  return (
    <>
      <Header active="Cars" />
      <main className="search-results">
        <div className="design-container">
          <div className="search-results-heading">
            <p className="eyebrow">YOUR SEARCH</p>
            <h1>
              {error
                ? "Check your dates"
                : `${cars.length} ${cars.length === 1 ? "car" : "cars"} available`}
            </h1>
            {!error && (
              <p>
                {when(q.pickup!)} to {when(q.returnAt!)}
                {q.location ? ` · ${q.location}` : ""}
              </p>
            )}
          </div>
          <div className="fleet-search-panel">
            <SearchForm initial={q} />
            <p>All times are in Ghana time (GMT).</p>
          </div>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : cars.length ? (
            <FleetBrowser
              key={`${query}:${q.category ?? ""}`}
              cars={cars}
              query={query}
              initialCategory={q.category}
            />
          ) : (
            <div className="empty">
              <h2>No cars are free for these dates.</h2>
              <p>Try different dates or another pickup point.</p>
              <Link className="button" href="/fleet">
                See all cars
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
