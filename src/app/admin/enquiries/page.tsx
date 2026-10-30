import { session } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function EnquiriesPage() {
  const current = await session();
  if (!current) redirect("/sign-in?next=/admin/enquiries");
  if (!["ADMIN", "MANAGER", "AGENT"].includes(current.user.role))
    return <p>Enquiry access required.</p>;
  const enquiries = await db.contactEnquiry.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <h1>Customer enquiries</h1>
      <p className="muted">Latest 100 messages submitted through Contact Us.</p>
      <section className="admin-enquiry-list">
        {enquiries.map((e) => (
          <article key={e.id} className="admin-panel">
            <div>
              <span className="eyebrow">
                {e.reference} · {e.subject}
              </span>
              <h2>{e.name}</h2>
              <p>
                <a href={`mailto:${e.email}`}>{e.email}</a>
                {e.phone ? ` · ${e.phone}` : ""}
              </p>
              <time dateTime={e.createdAt.toISOString()}>
                {e.createdAt.toLocaleString("en-GB", {
                  timeZone: "Africa/Accra",
                })}{" "}
                GMT
              </time>
            </div>
            <p className="enquiry-message">{e.message}</p>
          </article>
        ))}
      </section>
      {!enquiries.length && <p className="empty">No enquiries yet.</p>}
    </>
  );
}
