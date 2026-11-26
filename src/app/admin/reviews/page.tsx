import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ReviewActions } from "@/components/review-actions";
export const dynamic = "force-dynamic";
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Waiting for approval",
  APPROVED: "Approved",
  HIDDEN: "Hidden",
};
export default async function Reviews() {
  const current = await requireStaff();
  if (!can(current.user.role, "review.manage"))
    return <p>Review management is limited to managers and administrators.</p>;
  const reviews = await db.review.findMany({
    include: {
      booking: {
        select: { reference: true, vehicle: { select: { name: true } } },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });
  const order = { PENDING: 0, APPROVED: 1, HIDDEN: 2 } as const;
  const featured = reviews
    .filter((r) => r.featured)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const rest = reviews
    .filter((r) => !r.featured)
    .sort(
      (a, b) =>
        order[a.status as keyof typeof order] -
        order[b.status as keyof typeof order],
    );
  const row = (r: (typeof reviews)[number], i?: number) => (
    <article className="review-admin" key={r.id}>
      <div>
        <span
          className="testimonial-stars review-admin-stars"
          role="img"
          aria-label={`${r.rating} out of 5 stars`}
        >
          {"★".repeat(r.rating)}
          <span aria-hidden="true">{"★".repeat(5 - r.rating)}</span>
        </span>
        <blockquote>“{r.body}”</blockquote>
        <small>
          {r.displayName} · {r.booking.vehicle.name} ·{" "}
          <Link href={`/admin/bookings?q=${r.booking.reference}`}>
            {r.booking.reference}
          </Link>{" "}
          ·{" "}
          {r.createdAt.toLocaleDateString("en-GB", {
            timeZone: "Africa/Accra",
            dateStyle: "medium",
          })}
        </small>
      </div>
      <div className="review-admin-side">
        <span
          className={`notify-status notify-status--${r.status === "APPROVED" ? "sent" : r.status === "HIDDEN" ? "failed" : "queued"}`}
        >
          {r.featured ? "On the website" : STATUS_LABEL[r.status]}
        </span>
        <ReviewActions
          id={r.id}
          status={r.status}
          featured={r.featured}
          first={i === 0}
          last={i === featured.length - 1}
        />
      </div>
    </article>
  );
  return (
    <>
      <div className="admin-top">
        <div>
          <p className="eyebrow">CUSTOMER REVIEWS</p>
          <h1>Reviews</h1>
          <p>
            Customers can review a rental once the car is returned. Approve the
            reviews you trust, then choose which appear on the home and Cars
            pages and in what order. Reviews cannot be edited.
          </p>
        </div>
      </div>
      <section className="admin-panel">
        <h2>On the website ({featured.length})</h2>
        {featured.length ? (
          featured.map((r, i) => row(r, i))
        ) : (
          <p className="muted">
            No reviews are shown yet, so the reviews section is hidden on the
            website.
          </p>
        )}
      </section>
      <section className="admin-panel">
        <h2>All other reviews</h2>
        {rest.length ? (
          rest.map((r) => row(r))
        ) : (
          <p className="muted">No reviews yet.</p>
        )}
      </section>
    </>
  );
}
