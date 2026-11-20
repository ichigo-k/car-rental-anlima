import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/catalogue";
import { can } from "@/lib/permissions";
import { statusLabel } from "@/lib/booking-status";
import {
  REPORTS,
  isReportType,
  parseFilters,
  runReport,
  type Cell,
  type Column,
  type ReportType,
} from "@/lib/reports";
export const dynamic = "force-dynamic";
const SHOWN = 500;
const DATE_LABEL: Record<ReportType, string> = {
  bookings: "Pickup",
  payments: "Payment started",
  fleet: "Period",
  returns: "Returned",
  customers: "Booking made",
};
const BOOKING_STATUSES = [
  "PENDING_PAYMENT",
  "PAYMENT_REVIEW",
  "CONFIRMED",
  "CHECKED_OUT",
  "RETURNED",
  "CLOSED",
  "NO_SHOW",
  "CANCELLED",
];
function show(value: Cell, kind: Column["kind"]) {
  if (value === null || value === "") return "—";
  if (value instanceof Date)
    return value.toLocaleString("en-GB", {
      timeZone: "Africa/Accra",
      dateStyle: "medium",
      ...(kind === "date" ? { timeStyle: "short" } : {}),
    });
  if (typeof value === "number") {
    if (kind === "money") return money(value);
    if (kind === "percent") return `${Math.round(value)}%`;
    return value.toLocaleString("en-GB");
  }
  return value;
}
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const current = await requireStaff();
  if (!can(current.user.role, "report.export"))
    return <p>Your staff role does not include reports.</p>;
  const q = await searchParams;
  const type: ReportType = isReportType(q.type) ? q.type : "bookings";
  const filters = parseFilters(q);
  const [report, cars] = await Promise.all([
    runReport(db, type, filters),
    db.vehicle.findMany({
      select: { id: true, name: true, category: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const categories = [...new Set(cars.map((c) => c.category))].sort();
  const query = new URLSearchParams(
    Object.entries({ ...q, type }).filter(([, v]) => v) as [string, string][],
  ).toString();
  const has = (...types: ReportType[]) => types.includes(type);
  return (
    <>
      <div className="admin-top">
        <div>
          <p className="eyebrow">OPERATIONS</p>
          <h1>Reports</h1>
          <p>
            Filter a report, then export exactly what you see. Every export is
            recorded in the activity history.
          </p>
        </div>
      </div>
      <nav className="report-tabs" aria-label="Reports">
        {(Object.keys(REPORTS) as ReportType[]).map((t) => (
          <Link
            key={t}
            href={`/admin/reports?type=${t}`}
            aria-current={t === type ? "page" : undefined}
          >
            {REPORTS[t]}
          </Link>
        ))}
      </nav>
      <form className="admin-panel report-filters" method="get">
        <input type="hidden" name="type" value={type} />
        <label>
          {DATE_LABEL[type]} from
          <input type="date" name="from" defaultValue={q.from ?? ""} />
        </label>
        <label>
          to
          <input type="date" name="to" defaultValue={q.to ?? ""} />
        </label>
        {has("bookings") && (
          <label>
            Status
            <select name="status" defaultValue={q.status ?? ""}>
              <option value="">All statuses</option>
              {BOOKING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </label>
        )}
        {has("payments") && (
          <>
            <label>
              Provider
              <select name="provider" defaultValue={q.provider ?? ""}>
                <option value="">Both providers</option>
                <option value="PAYSTACK">Paystack</option>
                <option value="FLUTTERWAVE">Flutterwave</option>
              </select>
            </label>
            <label>
              Status
              <select name="status" defaultValue={q.status ?? ""}>
                <option value="">All payments</option>
                <option value="verified">Verified</option>
                <option value="review">Verified, needs review</option>
                <option value="unverified">Not verified</option>
              </select>
            </label>
          </>
        )}
        {has("bookings", "fleet", "returns") && (
          <>
            <label>
              Category
              <select name="category" defaultValue={q.category ?? ""}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Car
              <select name="vehicleId" defaultValue={q.vehicleId ?? ""}>
                <option value="">All cars</option>
                {cars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {has("bookings", "customers") && (
          <label>
            Customer
            <input
              name="q"
              defaultValue={q.q ?? ""}
              placeholder="Name, email or phone"
            />
          </label>
        )}
        <div className="report-actions">
          <button className="button small">Apply filters</button>
          <Link href={`/admin/reports?type=${type}`}>Reset</Link>
          <a
            className="button small secondary"
            href={`/api/admin/reports?${query}`}
          >
            Export CSV
          </a>
        </div>
      </form>
      <section className="report-summary" aria-label="Summary">
        {report.summary.map((s) => (
          <div className="admin-panel" key={s.label}>
            <span>{s.label}</span>
            <strong>
              {show(s.value, s.kind === "date" ? "text" : s.kind)}
            </strong>
          </div>
        ))}
      </section>
      <section className="admin-panel">
        {report.rows.length ? (
          <div className="report-table">
            <table className="data-table">
              <thead>
                <tr>
                  {report.columns.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.slice(0, SHOWN).map((r, i) => (
                  <tr key={i}>
                    {report.columns.map((c) => (
                      <td
                        key={c.key}
                        className={c.kind === "text" ? undefined : "num"}
                      >
                        {show(r[c.key], c.kind)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">Nothing matches these filters.</p>
        )}
        {(report.rows.length > SHOWN || report.truncated) && (
          <p className="muted">
            Showing the first {SHOWN} of {report.rows.length}
            {report.truncated ? "+" : ""} rows. The export includes up to
            10,000.
          </p>
        )}
      </section>
    </>
  );
}
