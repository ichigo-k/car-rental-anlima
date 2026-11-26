"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/catalogue";

type RefundRow = {
  id: string;
  amount: number;
  status: string;
  reason: string;
  createdAt: string;
  lastError: string | null;
};
const LABEL: Record<string, string> = {
  REQUESTED: "Sending…",
  PENDING: "In progress",
  PROCESSED: "Refunded",
  FAILED: "Not sent",
  UNKNOWN: "Check with provider",
};

// Refunds for one payment: history, a refund form and status checks.
export function RefundControls({
  paymentId,
  provider,
  refundable,
  suggestion,
  refunds,
  canRefund,
}: {
  paymentId: string;
  provider: string;
  refundable: number;
  suggestion: { label: string; amount: number } | null;
  refunds: RefundRow[];
  canRefund: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState(
    suggestion
      ? (Math.min(suggestion.amount, refundable) / 100).toFixed(2)
      : "",
  );
  async function post(url: string, body: object) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Something went wrong.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const blocked = refunds.some((r) =>
    ["REQUESTED", "UNKNOWN"].includes(r.status),
  );
  return (
    <div className="refund-controls">
      {refunds.map((r) => (
        <div
          key={r.id}
          className={`refund-row refund-${r.status.toLowerCase()}`}
        >
          <span>
            {money(r.amount)} · {LABEL[r.status] ?? r.status} ·{" "}
            {new Date(r.createdAt).toLocaleDateString("en-GB", {
              timeZone: "Africa/Accra",
            })}
          </span>
          <small>{r.reason}</small>
          {r.lastError && r.status !== "PROCESSED" && (
            <small className="error">{r.lastError}</small>
          )}
          {canRefund && r.status === "PENDING" && (
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() =>
                post(`/api/admin/refunds/${r.id}`, { action: "CHECK" })
              }
            >
              Check status
            </button>
          )}
          {canRefund && r.status === "UNKNOWN" && (
            <div className="refund-resolve">
              <small>
                Look for this refund in the {provider} dashboard, then record
                what you find.
              </small>
              <button
                type="button"
                className="button small secondary"
                disabled={busy}
                onClick={() => {
                  const id = window.prompt(
                    `The refund was sent. ${provider} refund ID (optional):`,
                  );
                  if (id !== null)
                    void post(`/api/admin/refunds/${r.id}`, {
                      action: "RESOLVE",
                      sent: true,
                      providerRefundId: id.trim() || undefined,
                    });
                }}
              >
                It was sent
              </button>
              <button
                type="button"
                className="button small secondary"
                disabled={busy}
                onClick={() =>
                  window.confirm("Confirm this refund was NOT sent?") &&
                  void post(`/api/admin/refunds/${r.id}`, {
                    action: "RESOLVE",
                    sent: false,
                  })
                }
              >
                It was not sent
              </button>
            </div>
          )}
        </div>
      ))}
      {canRefund && refundable > 0 && !blocked && !open && (
        <button
          type="button"
          className="button small secondary"
          onClick={() => setOpen(true)}
        >
          Refund
        </button>
      )}
      {open && (
        <form
          className="stack refund-form"
          onSubmit={(e) => {
            e.preventDefault();
            const pesewas = Math.round(Number(amount) * 100);
            const reason = String(new FormData(e.currentTarget).get("reason"));
            if (
              window.confirm(
                `Send ${money(pesewas)} back to the customer through ${provider}? This cannot be undone.`,
              )
            )
              void post(`/api/admin/payments/${paymentId}/refunds`, {
                amount: pesewas,
                reason,
              });
          }}
        >
          <p className="muted">
            Up to {money(refundable)} can be refunded.
            {suggestion &&
              ` ${suggestion.label}: ${money(Math.min(suggestion.amount, refundable))}.`}
          </p>
          <label>
            Amount (GHS)
            <input
              type="number"
              min="0.01"
              max={(refundable / 100).toFixed(2)}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <label>
            Reason
            <textarea name="reason" required minLength={5} maxLength={500} />
          </label>
          <button className="button small" disabled={busy}>
            {busy ? "Sending…" : "Send refund"}
          </button>
          <button type="button" disabled={busy} onClick={() => setOpen(false)}>
            Close
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
