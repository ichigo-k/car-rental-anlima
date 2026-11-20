import { requireStaff } from "@/lib/auth";
import { paymentOptions } from "@/lib/payment-config";
import { db } from "@/lib/db";
import { money } from "@/lib/catalogue";
import { can } from "@/lib/permissions";
import { cancellationTerms, getFees } from "@/lib/fees";
import { VERIFIED_PAYMENT, refundedTotals } from "@/lib/refunds";
import { RefundControls } from "@/components/refund-controls";
export const dynamic = "force-dynamic";
export default async function Payments() {
  const current = await requireStaff();
  if (!can(current.user.role, "payment.review"))
    return <p>Finance access required.</p>;
  const [payments, fees] = await Promise.all([
    db.payment.findMany({
      include: {
        booking: true,
        refunds: { orderBy: { createdAt: "asc" } },
      },
      take: 100,
      orderBy: { createdAt: "desc" },
    }),
    getFees(db),
  ]);
  const canRefund = can(current.user.role, "payment.refund");
  // What the booking says is owed back, to pre-fill the refund form.
  const suggestion = (p: (typeof payments)[number]) => {
    const b = p.booking;
    if (b.status === "CANCELLED" && b.cancelledAt)
      return {
        label: "Due under the cancellation policy",
        amount: p.amount - cancellationTerms(fees, b, b.cancelledAt).retained,
      };
    if (b.status === "CLOSED" && b.depositApplied !== null)
      return {
        label: "Deposit left after approved charges",
        amount: b.deposit - b.depositApplied,
      };
    return null;
  };
  return (
    <>
      <div className="admin-top">
        <h1>Payments</h1>
        {can(current.user.role, "report.export") && (
          <a href="/admin/reports?type=payments" className="button small">
            Payment reports
          </a>
        )}
      </div>
      <p className="muted">
        Latest 100 payment attempts. Only verified transactions are marked
        successful. Payments marked SUCCESS_REVIEW need staff review for a
        duplicate charge or refund; an existing confirmed rental stays reserved.
        Refunds go back through the provider that took the payment.
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
              <th>Refunds</th>
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
                <td>
                  {VERIFIED_PAYMENT.includes(p.status) ||
                  p.refunds.length > 0 ? (
                    <RefundControls
                      paymentId={p.id}
                      provider={
                        p.provider === "FLUTTERWAVE"
                          ? "Flutterwave"
                          : "Paystack"
                      }
                      refundable={
                        VERIFIED_PAYMENT.includes(p.status)
                          ? p.amount - refundedTotals(p.refunds).committed
                          : 0
                      }
                      suggestion={suggestion(p)}
                      canRefund={canRefund}
                      refunds={p.refunds.map((r) => ({
                        id: r.id,
                        amount: r.amount,
                        status: r.status,
                        reason: r.reason,
                        createdAt: r.createdAt.toISOString(),
                        lastError: r.lastError,
                      }))}
                    />
                  ) : (
                    "—"
                  )}
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
