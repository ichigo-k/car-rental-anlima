import { requireStaff } from "@/lib/auth";
import { paymentOptions } from "@/lib/payment-config";
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
        successful. Payments marked SUCCESS_REVIEW need staff review for a
        duplicate charge or refund; an existing confirmed rental stays reserved.
      </p>
      <section
        className="admin-payment-providers"
        aria-label="Payment provider setup"
      >
        {paymentOptions().map((p) => (
          <div className="admin-panel" key={p.id}>
            <h2>{p.name}</h2>
            <p>{p.enabled ? "Configured" : "Awaiting environment keys"}</p>
          </div>
        ))}
      </section>
      <div className="admin-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Payment reference</th>
              <th>Provider</th>
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
                <td>
                  {p.provider === "FLUTTERWAVE" ? "Flutterwave" : "Paystack"}
                </td>
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
