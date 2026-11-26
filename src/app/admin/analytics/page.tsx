import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/catalogue";
import { can } from "@/lib/permissions";
import { VERIFIED_PAYMENT } from "@/lib/refunds";
import { daily, ranked, stats } from "@/lib/site-analytics";
import { DailyVisits, Funnel, Ranked } from "@/components/analytics-charts";
export const dynamic = "force-dynamic";
const PERIODS = [7, 30, 90];
// Searching is optional (many open a car straight from the home page), so it
// is shown on its own rather than as a funnel step.
const STEPS = [
  ["car-viewed", "Viewed a car"],
  ["checkout-started", "Started payment"],
  ["booking-confirmed", "Booking confirmed"],
] as const;
const minutes = (seconds: number) =>
  seconds >= 60
    ? `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
    : `${Math.round(seconds)}s`;
// Change against the previous period of the same length.
function change(now: number, before: number | undefined) {
  if (before === undefined || before === 0) return null;
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct > 0 ? "+" : ""}${pct}% on the previous period`;
}

export default async function Analytics({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const current = await requireStaff();
  if (!can(current.user.role, "report.export"))
    return <p>Your staff role does not include analytics.</p>;
  const q = await searchParams;
  const days = PERIODS.includes(Number(q.days)) ? Number(q.days) : 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  const range = { from, to };

  // ANLIMA's own figures for the same period, always available.
  const [bookingsMade, verified] = await Promise.all([
    db.booking.count({ where: { createdAt: { gte: from, lte: to } } }),
    db.payment.findMany({
      where: {
        status: { in: VERIFIED_PAYMENT },
        verifiedAt: { gte: from, lte: to },
      },
      select: { amount: true },
    }),
  ]);
  const received = verified.reduce((s, p) => s + p.amount, 0);

  const [totals, series, pages, sources, devices, events] =
    await Promise.allSettled([
      stats(db, range),
      daily(db, range),
      ranked(db, range, "path"),
      ranked(db, range, "referrerHost"),
      ranked(db, range, "device", 5),
      ranked(db, range, "type", 20),
    ]);
  const value = <T,>(r: PromiseSettledResult<T>) =>
    r.status === "fulfilled" ? r.value : null;
  const problem = [totals, series, pages, sources, devices, events].some(
    (r) => r.status === "rejected",
  );
  const t = value(totals);
  const eventCount = new Map(
    (value(events) ?? []).map((e) => [e.name, e.value]),
  );
  const tile = (label: string, shown: string, note?: string | null) => (
    <div className="admin-panel" key={label}>
      <span>{label}</span>
      <strong>{shown}</strong>
      {note && <small>{note}</small>}
    </div>
  );
  return (
    <>
      <div className="admin-top">
        <div>
          <p className="eyebrow">WEBSITE</p>
          <h1>Analytics</h1>
          <p>
            Visits to the public website, counted by the site itself without
            cookies or personal data, next to ANLIMA&apos;s own booking figures.
            A visit is one person on one day.
          </p>
        </div>
      </div>
      <nav className="report-tabs" aria-label="Period">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={`/admin/analytics?days=${p}`}
            aria-current={p === days ? "page" : undefined}
          >
            Last {p} days
          </Link>
        ))}
      </nav>
      {problem && (
        <p className="admin-callout" role="alert">
          Some figures could not be loaded. Refresh the page to try again.
        </p>
      )}
      <section className="report-summary" aria-label="Summary">
        {t && [
          tile(
            "Visits",
            t.current.visits.toLocaleString("en-GB"),
            change(t.current.visits, t.previous?.visits),
          ),
          tile(
            "Page views",
            t.current.pageviews.toLocaleString("en-GB"),
            change(t.current.pageviews, t.previous?.pageviews),
          ),
          tile(
            "Left after one page",
            t.current.visits
              ? `${Math.round((t.current.bounces / t.current.visits) * 100)}%`
              : "—",
          ),
          tile(
            "Average visit",
            t.current.visits
              ? minutes(t.current.totaltime / t.current.visits)
              : "—",
          ),
        ]}
        {value(events) &&
          tile(
            "Searches",
            (eventCount.get("search") ?? 0).toLocaleString("en-GB"),
          )}
        {tile("Bookings made", bookingsMade.toLocaleString("en-GB"))}
        {tile(
          "Payments verified",
          verified.length.toLocaleString("en-GB"),
          `${money(received)} received`,
        )}
      </section>
      {value(series) && (
        <section className="admin-panel">
          <h2>Visits per day</h2>
          <DailyVisits days={value(series)!} />
        </section>
      )}
      {value(events) && (
        <section className="admin-panel">
          <h2>Booking funnel</h2>
          <p className="muted">
            Website steps counted by the site. ANLIMA&apos;s own totals above
            can be higher, because visitors who ask not to be tracked are not
            counted.
          </p>
          <Funnel
            steps={[
              ...(t ? [{ label: "Visits", value: t.current.visits }] : []),
              ...STEPS.map(([key, label]) => ({
                label,
                value: eventCount.get(key) ?? 0,
              })),
            ]}
          />
        </section>
      )}
      <div className="analytics-grid">
        {value(pages) && (
          <Ranked
            title="Top pages"
            rows={value(pages)!.map((r) => ({
              ...r,
              name: r.name === "/" ? "Home page" : r.name,
            }))}
            empty="No page views in this period."
          />
        )}
        {value(sources) && (
          <Ranked
            title="Where visitors came from"
            rows={value(sources)!.map((r) => ({
              ...r,
              name: r.name || "Direct or unknown",
            }))}
            empty="No referring websites in this period."
          />
        )}
        {value(devices) && (
          <Ranked
            title="Devices"
            rows={value(devices)!.map((r) => ({
              ...r,
              name: r.name
                ? r.name.charAt(0).toUpperCase() + r.name.slice(1)
                : "Unknown",
            }))}
            empty="No visits in this period."
          />
        )}
      </div>
    </>
  );
}
