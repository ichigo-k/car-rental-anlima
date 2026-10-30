import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { money } from "@/lib/catalogue";
import { bookingStatus, statusLabel } from "@/lib/booking-status";
export const dynamic = "force-dynamic";
export default async function Admin() {
  const current = await requireStaff();
  const now = new Date();
  const start = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z");
  const end = new Date(start.getTime() + 86400000);
  const canBookings = ["ADMIN", "MANAGER", "AGENT"].includes(current.user.role);
  const [ready, active, pickups, returns, pending, review, recent] =
    await Promise.all([
      db.vehicle.count({ where: { status: "AVAILABLE" } }),
      db.booking.count({ where: { status: "ACTIVE" } }),
      db.booking.count({
        where: { status: "CONFIRMED", pickup: { gte: start, lt: end } },
      }),
      db.booking.count({ where: { status: "ACTIVE", returnAt: { lt: end } } }),
      db.booking.count({
        where: { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } },
      }),
      db.booking.count({ where: { status: "PAYMENT_REVIEW" } }),
      canBookings
        ? db.booking.findMany({
            take: 8,
            orderBy: { createdAt: "desc" },
            include: { vehicle: true, user: { select: { name: true } } },
          })
        : Promise.resolve([]),
    ]);
  return (
    <>
      <div className="admin-top">
        <div>
          <p className="eyebrow">YOUR DAILY OVERVIEW</p>
          <h1>Hello, {current.user.name.split(" ")[0]}.</h1>
          <p>Keep the fleet moving and every reservation on track.</p>
        </div>
        <Link href="/admin/fleet" className="button small">
          Manage cars →
        </Link>
      </div>
      <div className="stats">
        {[
          ["Available in catalogue", ready, "/admin/fleet?status=AVAILABLE"],
          ["On the road", active, "/admin/bookings?status=ACTIVE"],
          ["Pickups today", pickups, "/admin/bookings?window=pickups"],
          ["Returns due / overdue", returns, "/admin/bookings?window=returns"],
        ].map(([label, value, href]) => (
          <article key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
            <Link
              href={
                canBookings || String(href).includes("/fleet")
                  ? String(href)
                  : "/admin/fleet"
              }
            >
              View details ↗
            </Link>
          </article>
        ))}
      </div>
      <div className="admin-attention">
        <div>
          <span className="admin-attention-number">{pending}</span>
          <div>
            <h2>Live payment holds</h2>
            <p>Unpaid reservations currently holding a car.</p>
          </div>
          {canBookings && (
            <Link href="/admin/bookings?status=PENDING_PAYMENT">
              View holds →
            </Link>
          )}
        </div>
        <div>
          <span className="admin-attention-number">{review}</span>
          <div>
            <h2>Payments to review</h2>
            <p>Resolve these before promising a pickup.</p>
          </div>
          {canBookings && (
            <Link href="/admin/bookings?status=PAYMENT_REVIEW">
              Review bookings →
            </Link>
          )}
        </div>
      </div>
      {canBookings ? (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Recent bookings</h2>
            <Link href="/admin/bookings">All bookings →</Link>
          </div>
          {recent.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Pickup · GMT</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recent.map((b) => {
                  const status = bookingStatus(b.status, b.holdExpiresAt, now);
                  return (
                    <tr key={b.id}>
                      <td>
                        <strong>{b.vehicle.name}</strong>
                        <small>{b.reference}</small>
                      </td>
                      <td>{b.customerName ?? b.user.name}</td>
                      <td>
                        {b.pickup.toLocaleDateString("en-GB", {
                          timeZone: "Africa/Accra",
                        })}
                      </td>
                      <td>{money(b.total)}</td>
                      <td>
                        <span
                          className={`ops-status ops-status--${status.toLowerCase()}`}
                        >
                          {statusLabel(status)}
                        </span>
                      </td>
                      <td>
                        <Link
                          className="text-link"
                          href={`/admin/bookings?q=${encodeURIComponent(b.reference)}`}
                        >
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty">
              <h3>No bookings yet.</h3>
              <p>New reservations will appear here as customers book.</p>
            </div>
          )}
        </section>
      ) : (
        <section className="admin-panel">
          <h2>Your fleet workspace</h2>
          <p>
            Review vehicles, rates and operational availability from the cars
            page.
          </p>
          <Link className="button small" href="/admin/fleet">
            Open fleet management
          </Link>
        </section>
      )}
    </>
  );
}
