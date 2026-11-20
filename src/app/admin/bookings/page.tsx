import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { RentalAction } from "@/components/rental-action";
import { BookingLifecycle } from "@/components/booking-lifecycle";
import { money } from "@/lib/catalogue";
import { bookingStatus, statusLabel } from "@/lib/booking-status";
import { getFees, cancellationTerms } from "@/lib/fees";
import { can } from "@/lib/permissions";
export const dynamic = "force-dynamic";
// When a photo was uploaded, and when the device says it was taken if that is
// more than ten minutes earlier: an old gallery photo stands out.
function photoTime(uploaded: Date, taken: Date | null) {
  const at = (d: Date) =>
    d.toLocaleString("en-GB", {
      timeZone: "Africa/Accra",
      dateStyle: "short",
      timeStyle: "short",
    });
  return taken && uploaded.getTime() - taken.getTime() > 10 * 60000
    ? `Taken ${at(taken)} · uploaded ${at(uploaded)}`
    : at(uploaded);
}
export default async function Reservations({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const current = await requireStaff();
  if (!can(current.user.role, "booking.read"))
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
    "CHECKED_OUT",
    "RETURNED",
    "CLOSED",
    "NO_SHOW",
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
    conditions.push({ status: "CHECKED_OUT", returnAt: { lt: end } });
  if (q.window === "cancel-requests")
    conditions.push({ status: "CONFIRMED", cancelRequestedAt: { not: null } });
  if (q.window === "to-close")
    conditions.push({ status: { in: ["RETURNED", "NO_SHOW"] } });
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
  const [fees, cars, [bookings, count]] = await Promise.all([
    getFees(db),
    db.vehicle.findMany({
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    }),
    Promise.all([
      db.booking.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          vehicle: true,
          inspections: {
            orderBy: { createdAt: "asc" },
            include: { photos: { orderBy: { createdAt: "asc" } } },
          },
          charges: { orderBy: { createdAt: "asc" } },
          changes: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      db.booking.count({ where }),
    ]),
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
          {
            {
              pickups: "Confirmed pickups today",
              returns: "Rentals due back today or overdue",
              "cancel-requests": "Customer cancellation requests",
              "to-close": "Returned or no-show rentals awaiting closure",
            }[q.window]
          }{" "}
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
              {b.status === "CONFIRMED" && b.cancelRequestedAt && (
                <p className="admin-callout">
                  The customer asked to cancel on{" "}
                  {b.cancelRequestedAt.toLocaleString("en-GB", {
                    timeZone: "Africa/Accra",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  . Apply the cancellation policy, then cancel the booking.
                </p>
              )}
              {b.status === "CANCELLED" && b.cancellationReason && (
                <p className="admin-callout subtle">
                  Cancelled: {b.cancellationReason}
                </p>
              )}
              {state === "EXPIRED" && (
                <p className="admin-callout subtle">
                  The unpaid hold has expired and no longer reserves
                  availability.
                </p>
              )}
              {["CONFIRMED", "CHECKED_OUT"].includes(b.status) &&
                can(current.user.role, "booking.write") && (
                  <RentalAction
                    id={b.id}
                    kind={b.status === "CONFIRMED" ? "CHECKOUT" : "RETURN"}
                  />
                )}
              <BookingLifecycle
                id={b.id}
                status={state}
                role={current.user.role}
                pickupPassed={b.pickup <= now}
                deposit={b.deposit}
                depositApplied={b.depositApplied}
                presets={{
                  CLEANING: fees.cleaningFee,
                  SMOKING: fees.smokingFee,
                }}
                cancellation={
                  b.status === "CONFIRMED"
                    ? cancellationTerms(fees, b, now)
                    : null
                }
                booking={{
                  vehicleId: b.vehicleId,
                  pickup: b.pickup.toISOString(),
                  returnAt: b.returnAt.toISOString(),
                }}
                cars={cars.filter(
                  (c) => c.status === "AVAILABLE" || c.id === b.vehicleId,
                )}
                charges={b.charges.map((c) => ({
                  id: c.id,
                  kind: c.kind,
                  amount: c.amount,
                  reason: c.reason,
                  evidence: c.evidence,
                  status: c.status,
                }))}
              />
              {b.changes.length > 0 && (
                <details className="admin-inspections">
                  <summary>Change history ({b.changes.length})</summary>
                  {b.changes.map((c) => {
                    const name = (vid: string) =>
                      cars.find((v) => v.id === vid)?.name ?? "Unknown car";
                    const at = (d: Date) =>
                      d.toLocaleString("en-GB", {
                        timeZone: "Africa/Accra",
                        dateStyle: "medium",
                        timeStyle: "short",
                      });
                    return (
                      <p key={c.id}>
                        {at(c.createdAt)}: {name(c.fromVehicleId)},{" "}
                        {at(c.fromPickup)} to {at(c.fromReturn)} →{" "}
                        {name(c.toVehicleId)}, {at(c.toPickup)} to{" "}
                        {at(c.toReturn)}.{" "}
                        {c.priceDifference > 0
                          ? `${money(c.priceDifference)} more${c.chargeId ? ", added as a charge" : ", not charged"}.`
                          : c.priceDifference < 0
                            ? `${money(-c.priceDifference)} credit owed to the customer.`
                            : "Same price."}{" "}
                        Reason: {c.reason}
                      </p>
                    );
                  })}
                </details>
              )}
              <details className="admin-inspections">
                <summary>Inspection history ({b.inspections.length})</summary>
                {b.inspections.length ? (
                  b.inspections.map((i) => (
                    <div key={i.id} className="inspection-record">
                      <p>
                        <strong>
                          {i.kind === "CHECKOUT" ? "Handover" : "Return"}
                        </strong>{" "}
                        ·{" "}
                        {i.createdAt.toLocaleString("en-GB", {
                          timeZone: "Africa/Accra",
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}{" "}
                        · {i.mileage.toLocaleString()} km · {i.fuel} ·{" "}
                        {i.condition}
                      </p>
                      {i.photos.length > 0 && (
                        <ul className="inspection-photo-grid">
                          {i.photos.map((photo) => (
                            <li key={photo.id}>
                              <a
                                href={`/api/admin/photos/${photo.id}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <img
                                  src={`/api/admin/photos/${photo.id}`}
                                  alt={`${i.kind === "CHECKOUT" ? "Handover" : "Return"} photo`}
                                  loading="lazy"
                                />
                              </a>
                              <small>
                                {photoTime(photo.createdAt, photo.takenAt)}
                              </small>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
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
