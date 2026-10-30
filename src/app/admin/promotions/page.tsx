import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { PromotionEditor } from "@/components/promotion-editor";
import { money } from "@/lib/catalogue";
export const dynamic = "force-dynamic";
export default async function Promotions() {
  const current = await requireStaff();
  if (!["ADMIN", "MANAGER", "FINANCE"].includes(current.user.role))
    return (
      <section className="admin-panel">
        <h1>Promotion access required.</h1>
      </section>
    );
  const now = new Date();
  const [promotions, vehicles] = await Promise.all([
    db.promotion.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            bookings: {
              where: {
                OR: [
                  {
                    status: {
                      in: [
                        "CONFIRMED",
                        "ACTIVE",
                        "COMPLETED",
                        "PAYMENT_REVIEW",
                      ],
                    },
                  },
                  { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } },
                ],
              },
            },
          },
        },
      },
    }),
    db.vehicle.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const canEdit = ["ADMIN", "MANAGER"].includes(current.user.role);
  return (
    <>
      <div className="admin-top">
        <div>
          <p className="eyebrow">OFFERS & INCENTIVES</p>
          <h1>Promotions & vouchers</h1>
          <p>
            Car discounts, automatic offers and coupon codes, all in one place.
          </p>
        </div>
      </div>
      {canEdit && <PromotionEditor vehicles={vehicles} />}
      <p className="admin-result-count">
        Usage includes confirmed rentals and live payment holds. Expired unpaid
        holds release their use. Existing reservation prices stay unchanged when
        you edit an offer.
      </p>
      <div className="admin-promotion-list">
        {promotions.map((p) => {
          const state = !p.active
            ? "Paused"
            : p.endsAt <= now
              ? "Ended"
              : p.startsAt > now
                ? "Scheduled"
                : p.maxUses !== null && p._count.bookings >= p.maxUses
                  ? "Fully used"
                  : "Live";
          return (
            <article className="admin-panel" key={p.id}>
              <div className="admin-panel-heading">
                <div>
                  <span
                    className={`ops-status ${state === "Live" ? "ops-status--confirmed" : ""}`}
                  >
                    {state}
                  </span>
                  <h2>{p.name}</h2>
                </div>
                <strong className="promotion-value">
                  {p.discountType === "PERCENT"
                    ? `${p.value}%`
                    : money(p.value)}{" "}
                  off
                </strong>
              </div>
              <div className="admin-booking-info">
                <div>
                  <h3>How it applies</h3>
                  <strong>
                    {p.code ? `Code: ${p.code}` : "Automatic discount"}
                  </strong>
                  <p>
                    {p.vehicleIds.length
                      ? p.vehicleIds
                          .map(
                            (id) =>
                              vehicles.find((v) => v.id === id)?.name ??
                              "Removed vehicle",
                          )
                          .join(", ")
                      : "All cars"}
                  </p>
                </div>
                <div>
                  <h3>Offer window · GMT</h3>
                  <strong>
                    {p.startsAt.toLocaleString("en-GB", {
                      timeZone: "Africa/Accra",
                    })}
                  </strong>
                  <p>
                    to{" "}
                    {p.endsAt.toLocaleString("en-GB", {
                      timeZone: "Africa/Accra",
                    })}
                  </p>
                </div>
                <div>
                  <h3>Limits</h3>
                  <strong>
                    {p._count.bookings}
                    {p.maxUses !== null ? ` / ${p.maxUses}` : ""} uses
                  </strong>
                  <p>Minimum rental: {money(p.minimumRental)}</p>
                </div>
              </div>
              {canEdit && (
                <PromotionEditor
                  vehicles={vehicles}
                  promotion={{
                    ...p,
                    startsAt: p.startsAt.toISOString(),
                    endsAt: p.endsAt.toISOString(),
                  }}
                />
              )}
            </article>
          );
        })}
      </div>
      {!promotions.length && (
        <section className="admin-panel empty">
          <h2>Your first offer starts here.</h2>
          <p>
            Create a fleet discount, a car-specific offer, or a voucher
            customers can apply during booking.
          </p>
        </section>
      )}
    </>
  );
}
