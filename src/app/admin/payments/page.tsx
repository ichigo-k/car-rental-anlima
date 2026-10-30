import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/catalogue";
export const dynamic = "force-dynamic";
export default async function Payments() {
  const current = await requireStaff();
  if (!["ADMIN", "MANAGER", "FINANCE"].includes(current.user.role))
    return <p>Finance access required.</p>;
  const payments = await db.payment.findMany({
    include: { booking: true },
    take: 100,
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <div className="admin-top">
        <h1>Payments & reports</h1>
        <a href="/api/admin/reports" className="button small">
          Export reservations CSV
        </a>
      </div>
      <p className="muted">
        Latest 100 payment attempts. Only verified transactions are marked
        successful.
      </p>
      <div className="admin-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Payment reference</th>
              <th>Booking</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Verified</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{p.reference}</td>
                <td>{p.booking.reference}</td>
                <td>{money(p.amount)}</td>
                <td>{p.status}</td>
                <td>
                  {p.verifiedAt?.toLocaleString("en-GB", {
                    timeZone: "Africa/Accra",
                  }) ?? "Awaiting verification"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!payments.length && (
          <div className="empty">No payment attempts yet.</div>
        )}
      </div>
    </>
  );
}
