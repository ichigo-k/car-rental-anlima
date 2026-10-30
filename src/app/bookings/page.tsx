import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomerShell } from "@/components/customer-shell";
import { ReservationPayment } from "@/components/reservation-payment";
import { VehicleImage } from "@/components/vehicle-image";
import { session } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/catalogue";
export const dynamic = "force-dynamic";
export default async function Bookings({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const current = await session();
  if (!current) redirect("/sign-in?next=/bookings");
  const bookings = await db.booking.findMany({
    where: { userId: current.user.id },
    include: { vehicle: true },
    orderBy: { createdAt: "desc" },
  });
  const q = await searchParams;
  const now = new Date();
  const pending = bookings.filter(
    (b) => b.status === "PENDING_PAYMENT" && b.holdExpiresAt > now,
  );
  const isHistory = (b: (typeof bookings)[number]) =>
    b.returnAt < now ||
    ["CANCELLED", "COMPLETED"].includes(b.status) ||
    (b.status === "PENDING_PAYMENT" && b.holdExpiresAt <= now);
  const view = ["upcoming", "history"].includes(q.view ?? "") ? q.view : "all";
  const visible = bookings.filter((b) =>
    view === "history"
      ? isHistory(b)
      : view === "upcoming"
        ? !isHistory(b)
        : true,
  );
  const favouriteCount = await db.favourite.count({
    where: { userId: current.user.id },
  });
  return (
    <CustomerShell
      name={current.user.name}
      email={current.user.email}
      active="bookings"
    >
      <div className="customer-page">
        <div className="page-heading">
          <p className="account-breadcrumb">Account / Overview</p>
          <h1>Hello, {current.user.name.split(" ")[0]}.</h1>
          <p>Your reservations, all in one place.</p>
        </div>
        <div className="account-summary-grid">
          <div className="account-summary navy-tile">
            <span>Awaiting payment</span>
            <strong>{pending.length}</strong>
            <p>
              {pending.length
                ? "Complete payment below to confirm your car."
                : "You’re all caught up. Plan your next drive."}
            </p>
            <a href="#reservations">View reservations →</a>
          </div>
          <div className="account-summary">
            <span>Your journeys</span>
            <strong>{bookings.filter((b) => !isHistory(b)).length}</strong>
            <p>Current and upcoming reservations</p>
            <Link href="/fleet">Explore the fleet →</Link>
          </div>
          <div className="account-summary gold-tile">
            <span>Saved for the road</span>
            <strong>{favouriteCount}</strong>
            <p>Your favourite cars, ready when you are.</p>
            <Link href="/favourites">See favourite cars →</Link>
          </div>
        </div>
        {q.reference && bookings.some((b) => b.reference === q.reference) && (
          <p className="reservation-success" role="status">
            Reservation saved. If payment is still pending, complete it within
            the countdown below to confirm your car.
          </p>
        )}
        <div className="reservations-title" id="reservations">
          <h2>My reservations</h2>
          <Link className="text-link" href="/fleet">
            Find a car →
          </Link>
        </div>
        <nav className="reservation-tabs" aria-label="Filter reservations">
          {[
            ["all", "All reservations"],
            ["upcoming", "Current & upcoming"],
            ["history", "Past & expired"],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={`/bookings${key === "all" ? "" : `?view=${key}`}#reservations`}
              aria-current={view === key ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        {!visible.length ? (
          <div className="empty">
            <h2>
              {bookings.length
                ? "No reservations in this view."
                : "Your next journey is waiting."}
            </h2>
            <p>
              {bookings.length
                ? "Try another tab or start planning your next trip."
                : "Choose a car, tell us your plans, and we’ll take it from there."}
            </p>
            <Link href="/fleet" className="button">
              Explore the fleet
            </Link>
          </div>
        ) : (
          <div className="booking-list">
            {visible.map((b) => (
              <article key={b.id} className="booking-row">
                <VehicleImage
                  slug={b.vehicle.slug}
                  image={b.vehicle.image}
                  name={b.vehicle.name}
                />
                <div>
                  <span className="muted">{b.reference}</span>
                  <h2>{b.vehicle.name}</h2>
                  <p>
                    {b.pickup.toLocaleString("en-GB", {
                      timeZone: "Africa/Accra",
                    })}{" "}
                    →{" "}
                    {b.returnAt.toLocaleString("en-GB", {
                      timeZone: "Africa/Accra",
                    })}
                  </p>
                  <p>{b.location}</p>
                  <p className="muted">
                    {b.customerName ?? current.user.name}
                    {b.ghanaCardLast4
                      ? ` · Ghana Card ending ${b.ghanaCardLast4}`
                      : ""}
                  </p>
                  <span className="status">
                    {b.status === "PENDING_PAYMENT" &&
                    b.holdExpiresAt < new Date()
                      ? "PAYMENT HOLD EXPIRED"
                      : b.status.replaceAll("_", " ")}
                  </span>
                  {b.status === "PAYMENT_REVIEW" && (
                    <p className="error">
                      Payment received. Staff must resolve vehicle availability
                      before confirming pickup.
                    </p>
                  )}
                </div>
                <div>
                  <h3>{money(b.total)}</h3>
                  {b.discountAmount > 0 && (
                    <p className="coupon-success">
                      {b.promotionName ?? "Offer"} · Saved{" "}
                      {money(b.discountAmount)}
                    </p>
                  )}
                  <p className="muted">
                    Includes {money(b.deposit)} refundable deposit
                  </p>
                  {b.status === "PENDING_PAYMENT" && (
                    <ReservationPayment
                      reference={b.reference}
                      expiresAt={b.holdExpiresAt.toISOString()}
                      slug={b.vehicle.slug}
                    />
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
