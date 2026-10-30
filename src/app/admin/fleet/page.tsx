import Link from "next/link";
import { VehicleCreate } from "@/components/vehicle-create";
import { VehicleBlock } from "@/components/vehicle-block";
import { VehicleImage } from "@/components/vehicle-image";
import { FleetEditor } from "@/components/fleet-editor";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { money } from "@/lib/catalogue";
import { statusLabel } from "@/lib/booking-status";
export const dynamic = "force-dynamic";
export default async function FleetAdmin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const current = await requireStaff();
  const q = await searchParams;
  const cars = await db.vehicle.findMany({
    orderBy: { name: "asc" },
    include: {
      blocks: {
        where: { end: { gt: new Date() } },
        orderBy: { start: "asc" },
        take: 3,
      },
    },
  });
  const status = ["AVAILABLE", "MAINTENANCE", "INACTIVE"].includes(
    q.status ?? "",
  )
    ? q.status
    : "";
  const search = (q.q ?? "").trim().slice(0, 100);
  const visible = cars.filter(
    (c) =>
      (!status || c.status === status) &&
      `${c.name} ${c.category} ${c.slug}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const canEdit = ["ADMIN", "MANAGER", "FLEET"].includes(current.user.role);
  return (
    <>
      <div className="admin-top">
        <div>
          <p className="eyebrow">FLEET MANAGEMENT</p>
          <h1>Cars & availability</h1>
          <p>
            Vehicle details, daily rates, pickup points and maintenance dates.
          </p>
        </div>
        <Link className="button secondary small" href="/fleet">
          View public fleet ↗
        </Link>
      </div>
      <div className="admin-fleet-counts">
        {["AVAILABLE", "MAINTENANCE", "INACTIVE"].map((s) => (
          <Link
            key={s}
            href={`/admin/fleet?status=${s}`}
            aria-current={status === s ? "page" : undefined}
          >
            <strong>{cars.filter((c) => c.status === s).length}</strong>
            {statusLabel(s)}
          </Link>
        ))}
      </div>
      {canEdit && <VehicleCreate />}
      <form className="admin-filters" method="GET">
        <label>
          Find a car
          <input
            name="q"
            defaultValue={search}
            placeholder="Name, category or URL slug"
          />
        </label>
        <label>
          Status
          <select name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {["AVAILABLE", "MAINTENANCE", "INACTIVE"].map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <button className="button small">Search cars</button>
        <Link href="/admin/fleet">Reset</Link>
      </form>
      <p className="admin-result-count">
        {visible.length} of {cars.length} vehicles · “Available” controls
        catalogue visibility; rental dates are checked separately.
      </p>
      <div className="admin-car-list">
        {visible.map((c) => (
          <article className="admin-car" key={c.id}>
            <div className="admin-car-summary">
              <VehicleImage slug={c.slug} image={c.image} name={c.name} />
              <div>
                <span
                  className={`ops-status ops-status--${c.status.toLowerCase()}`}
                >
                  {statusLabel(c.status)}
                </span>
                <h2>{c.name}</h2>
                <p>
                  {c.category} · {c.seats} seats · {c.transmission} · {c.fuel}
                </p>
                <Link href={`/fleet/${c.slug}`} className="text-link">
                  View public listing ↗
                </Link>
              </div>
              <div className="admin-car-price">
                <strong>
                  {money(c.dailyRate)}
                  <small> / day</small>
                </strong>
                <span>{money(c.deposit)} refundable deposit</span>
              </div>
            </div>
            <div className="admin-car-details">
              <div>
                <h3>Pickup points</h3>
                <p>{c.pickupPoints.join(" · ")}</p>
              </div>
              <div>
                <h3>Upcoming date blocks</h3>
                {c.blocks.length ? (
                  c.blocks.map((b) => (
                    <p key={b.id}>
                      {b.start.toLocaleDateString("en-GB", {
                        timeZone: "Africa/Accra",
                      })}{" "}
                      –{" "}
                      {b.end.toLocaleDateString("en-GB", {
                        timeZone: "Africa/Accra",
                      })}{" "}
                      · {b.reason}
                    </p>
                  ))
                ) : (
                  <p>No active or upcoming blocks.</p>
                )}
              </div>
            </div>
            {canEdit && (
              <div className="admin-car-actions">
                <FleetEditor
                  car={{
                    id: c.id,
                    name: c.name,
                    category: c.category,
                    seats: c.seats,
                    image: c.image,
                    description: c.description,
                    status: c.status,
                    dailyRate: c.dailyRate,
                    deposit: c.deposit,
                    pickupPoints: c.pickupPoints,
                  }}
                />
                <VehicleBlock id={c.id} />
              </div>
            )}
          </article>
        ))}
      </div>
      {!visible.length && (
        <div className="admin-panel empty">
          <h2>No matching cars.</h2>
          <p>Try another name or status.</p>
          <Link href="/admin/fleet" className="button small">
            Clear filters
          </Link>
        </div>
      )}
    </>
  );
}
