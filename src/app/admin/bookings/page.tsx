import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { RentalAction } from "@/components/rental-action";
import { money } from "@/lib/catalogue";
import { bookingStatus, statusLabel } from "@/lib/booking-status";
export const dynamic = "force-dynamic";
export default async function Reservations({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const current = await requireStaff();
  if (!["ADMIN", "MANAGER", "AGENT"].includes(current.user.role))
    return (
      <section className="admin-panel">
        <h1>Booking access required.</h1>
        <p>Your staff role does not include reservation management.</p>
      </section>
    );
  const q = await searchParams;
  const now = new Date();
  const start = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z");
  const end = new Date(start.getTime() + 86400000);
  const statuses = [
    "PENDING_PAYMENT",
    "CONFIRMED",
    "ACTIVE",
    "COMPLETED",
    "CANCELLED",
    "PAYMENT_REVIEW",
    "EXPIRED",
  ];
  const status = statuses.includes(q.status ?? "") ? q.status : "";
  const search = (q.q ?? "").trim().slice(0, 100);
  const conditions: Prisma.BookingWhereInput[] = [];
  if (status === "EXPIRED")
    conditions.push({ status: "PENDING_PAYMENT", holdExpiresAt: { lte: now } });
  else if (status)
    conditions.push({
      status,
      ...(status === "PENDING_PAYMENT" ? { holdExpiresAt: { gt: now } } : {}),
    });
  if (q.window === "pickups")
    conditions.push({ status: "CONFIRMED", pickup: { gte: start, lt: end } });
  if (q.window === "returns")
    conditions.push({ status: "ACTIVE", returnAt: { lt: end } });
  if (search)
    conditions.push({
      OR: [
        { reference: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { vehicle: { name: { contains: search, mode: "insensitive" } } },
      ],
    });
  const where = { AND: conditions };
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(q.page ?? "1", 10) || 1),
  );
  const pageSize = 20;
  const [bookings, count] = await Promise.all([
    db.booking.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        vehicle: true,
        inspections: true,
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    db.booking.count({ where }),
  ]);
  const pageLink = (n: number) =>
    `/admin/bookings?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(status ? { status } : {}), ...(q.window ? { window: q.window } : {}), page: String(n) })}`;
  return (
    <>
      <div className="admin-top">
        <div>
          <p className="eyebrow">RESERVATION MANAGEMENT</p>
          <h1>Bookings</h1>
          <p>
            Find a reservation, check its status, and manage handover or return.
          </p>
        </div>
        <Link className="button secondary small" href="/admin/fleet">
          View cars →
        </Link>
      </div>
      <form className="admin-filters" method="GET">
        <label>
          Find a booking
          <input
            name="q"
            defaultValue={search}
            placeholder="Reference, customer, phone or car"
          />
        </label>
        <label>
          Status
          <select name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        {q.window && <input type="hidden" name="window" value={q.window} />}
        <button className="button small">Search bookings</button>
        <Link href="/admin/bookings">Reset</Link>
      </form>
      {q.window && (
        <p className="admin-result-count">
          {q.window === "pickups"
            ? "Confirmed pickups today"
            : "Active rentals due back today or overdue"}{" "}
          · <Link href="/admin/bookings">Clear date filter</Link>
        </p>
      )}
      <div className="admin-panel-heading">
        <h2>
          {count} booking{count === 1 ? "" : "s"}
        </h2>
        <span>All dates in Ghana time (GMT)</span>
      </div>
      <div className="admin-booking-list">
        {bookings.map((b) => {
          const state = bookingStatus(b.status, b.holdExpiresAt, now);
          return (
            <article className="admin-booking" key={b.id}>
              <div className="admin-booking-heading">
                <div>
                  <small>{b.reference}</small>
                  <h2>{b.vehicle.name}</h2>
                </div>
                <span
                  className={`ops-status ops-status--${state.toLowerCase()}`}
                >
                  {statusLabel(state)}
                </span>
                <strong>{money(b.total)}</strong>
                {b.discountAmount > 0 && (
                  <span className="ops-status">
                    {b.promotionName ?? "Offer"} · −{money(b.discountAmount)}
                    {b.couponCode ? ` · ${b.couponCode}` : ""}
                  </span>
                )}
              </div>
              <div className="admin-booking-info">
                <div>
                  <h3>Customer</h3>
                  <strong>{b.customerName ?? b.user.name}</strong>
                  <a href={`mailto:${b.customerEmail ?? b.user.email}`}>
                    {b.customerEmail ?? b.user.email}
                  </a>
                  <a href={`tel:${b.phone}`}>{b.phone}</a>
                  {b.ghanaCardLast4 && (
                    <small>Ghana Card ending {b.ghanaCardLast4}</small>
                  )}
                </div>
                <div>
                  <h3>Pickup</h3>
                  <strong>
                    {b.pickup.toLocaleString("en-GB", {
                      timeZone: "Africa/Accra",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </strong>
                  <p>{b.location}</p>
                </div>
                <div>
                  <h3>Return</h3>
                  <strong>
                    {b.returnAt.toLocaleString("en-GB", {
                      timeZone: "Africa/Accra",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </strong>
                  <p>
                    {b.days} rental days · {money(b.deposit)} deposit
                  </p>
                </div>
              </div>
              {state === "PAYMENT_REVIEW" && (
                <p className="admin-callout">
                  Payment needs staff review. Resolve availability and payment
                  before confirming pickup.
                </p>
              )}
              {state === "PENDING_PAYMENT" && (
                <p className="admin-callout">
                  Payment hold ends at{" "}
                  {b.holdExpiresAt.toLocaleTimeString("en-GB", {
                    timeZone: "Africa/Accra",
                  })}{" "}
                  GMT. This car is not confirmed yet.
                </p>
              )}
              {state === "EXPIRED" && (
                <p className="admin-callout subtle">
                  The unpaid hold has expired and no longer reserves
                  availability.
                </p>
              )}
              {["CONFIRMED", "ACTIVE"].includes(b.status) && (
                <RentalAction
                  id={b.id}
                  kind={b.status === "CONFIRMED" ? "CHECKOUT" : "RETURN"}
                />
              )}
              <details className="admin-inspections">
                <summary>Inspection history ({b.inspections.length})</summary>
                {b.inspections.length ? (
                  b.inspections.map((i) => (
                    <p key={i.id}>
                      {i.kind} · {i.mileage.toLocaleString()} km · {i.fuel} ·{" "}
                      {i.condition}
                    </p>
                  ))
                ) : (
                  <p>No handover or return inspection recorded.</p>
                )}
              </details>
            </article>
          );
        })}
      </div>
      {!bookings.length && (
        <section className="admin-panel empty">
          <h2>No matching bookings.</h2>
          <p>Try another reference, customer or status.</p>
          <Link className="button small" href="/admin/bookings">
            Clear filters
          </Link>
        </section>
      )}
      <nav className="admin-pagination" aria-label="Booking pages">
        <span>
          Page {page} · {count} results
        </span>
        {page > 1 && <Link href={pageLink(page - 1)}>← Previous</Link>}
        {page * pageSize < count && (
          <Link href={pageLink(page + 1)}>Next →</Link>
        )}
      </nav>
    </>
  );
}
