"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/catalogue";
import { BookingChangeForm } from "./booking-change-form";
import {
  allowed,
  canTransition,
  CHARGE_KINDS,
  settlement,
} from "@/lib/booking-lifecycle";
type Charge = {
  id: string;
  kind: string;
  amount: number;
  reason: string;
  evidence: string | null;
  status: string;
};
const label = (kind: string) =>
  kind.charAt(0) + kind.slice(1).toLowerCase().replaceAll("_", " ");
export function BookingLifecycle({
  id,
  status,
  role,
  pickupPassed,
  deposit,
  charges,
  depositApplied,
  presets,
  cancellation,
  booking,
  cars,
}: {
  id: string;
  status: string;
  role: string;
  pickupPassed: boolean;
  deposit: number;
  charges: Charge[];
  depositApplied: number | null;
  presets: Partial<Record<(typeof CHARGE_KINDS)[number], number>>;
  cancellation: { free: boolean; retained: number } | null;
  booking: { vehicleId: string; pickup: string; returnAt: string };
  cars: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<"" | "cancel" | "charge" | "change">("");
  const [kind, setKind] = useState<(typeof CHARGE_KINDS)[number]>("LATE");
  async function send(body: object) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/bookings/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not update this booking.");
      setForm("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const canCancel =
    allowed("cancel", role) && canTransition(status, "CANCELLED");
  const canNoShow =
    allowed("noShow", role) && canTransition(status, "NO_SHOW") && pickupPassed;
  const canChange =
    allowed("change", role) && ["CONFIRMED", "CHECKED_OUT"].includes(status);
  const chargeable = ["CHECKED_OUT", "RETURNED", "NO_SHOW"].includes(status);
  const showCharges = chargeable || status === "CLOSED" || charges.length > 0;
  const result = settlement(deposit, charges);
  const canClose = allowed("close", role) && canTransition(status, "CLOSED");
  if (!canCancel && !canNoShow && !showCharges && !canChange) return null;
  return (
    <div className="booking-lifecycle">
      {showCharges && (
        <section>
          <h3>Additional charges</h3>
          {charges.length ? (
            <ul className="charge-list">
              {charges.map((c) => (
                <li key={c.id}>
                  <div>
                    <strong>
                      {label(c.kind)} · {money(c.amount)}
                    </strong>
                    <span
                      className={`charge-status charge-status--${c.status.toLowerCase()}`}
                    >
                      {c.status === "PROPOSED"
                        ? "Awaiting decision"
                        : c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                    </span>
                    <p>{c.reason}</p>
                    {c.evidence && <small>Evidence: {c.evidence}</small>}
                  </div>
                  {c.status === "PROPOSED" &&
                    status !== "CLOSED" &&
                    allowed("decideCharge", role) && (
                      <div className="charge-actions">
                        <button
                          className="button small"
                          disabled={busy}
                          onClick={() =>
                            send({
                              action: "DECIDE_CHARGE",
                              chargeId: c.id,
                              decision: "APPROVED",
                            })
                          }
                        >
                          Approve
                        </button>
                        <button
                          className="button small secondary"
                          disabled={busy}
                          onClick={() =>
                            send({
                              action: "DECIDE_CHARGE",
                              chargeId: c.id,
                              decision: "WAIVED",
                            })
                          }
                        >
                          Waive
                        </button>
                      </div>
                    )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No additional charges recorded.</p>
          )}
          <p className="settlement">
            {status === "CLOSED"
              ? `Closed · ${money(depositApplied ?? 0)} of the ${money(deposit)} deposit applied`
              : `Deposit ${money(deposit)} · approved charges ${money(result.approved)} · refund ${money(result.refund)}`}
            {result.owed > 0 && ` · customer owes ${money(result.owed)}`}
          </p>
        </section>
      )}
      <div className="lifecycle-actions">
        {chargeable && allowed("proposeCharge", role) && form !== "charge" && (
          <button
            className="button small secondary"
            onClick={() => setForm("charge")}
          >
            Add charge
          </button>
        )}
        {canChange && form !== "change" && (
          <button
            className="button small secondary"
            onClick={() => setForm("change")}
          >
            {status === "CHECKED_OUT" ? "Change return time" : "Change booking"}
          </button>
        )}
        {canNoShow && (
          <button
            className="button small secondary"
            disabled={busy}
            onClick={() => send({ action: "NO_SHOW" })}
          >
            Mark no-show
          </button>
        )}
        {canCancel && form !== "cancel" && (
          <button
            className="button small secondary"
            onClick={() => setForm("cancel")}
          >
            Cancel booking
          </button>
        )}
        {canClose && (
          <button
            className="button small"
            disabled={busy || result.undecided}
            title={
              result.undecided
                ? "Approve or waive every proposed charge first"
                : undefined
            }
            onClick={() => send({ action: "CLOSE" })}
          >
            Close rental
          </button>
        )}
      </div>
      {form === "change" && (
        <BookingChangeForm
          id={id}
          onRoad={status === "CHECKED_OUT"}
          {...booking}
          cars={cars}
          onClose={() => setForm("")}
        />
      )}
      {form === "cancel" && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            send({
              action: "CANCEL",
              reason: new FormData(e.currentTarget).get("reason"),
            });
          }}
        >
          {cancellation && (
            <p className="muted">
              {cancellation.free
                ? "Within the free cancellation window: refund the full amount paid."
                : `Under the cancellation policy, keep ${money(cancellation.retained)} of the rental and refund the rest, including the deposit.`}
            </p>
          )}
          <label>
            Cancellation reason
            <textarea name="reason" required minLength={5} maxLength={500} />
          </label>
          <button className="button small" disabled={busy}>
            Confirm cancellation
          </button>
          <button type="button" disabled={busy} onClick={() => setForm("")}>
            Keep booking
          </button>
        </form>
      )}
      {form === "charge" && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const evidence = String(f.get("evidence") ?? "").trim();
            send({
              action: "ADD_CHARGE",
              charge: {
                kind: f.get("kind"),
                amount: Math.round(Number(f.get("amount")) * 100),
                reason: f.get("reason"),
                ...(evidence ? { evidence } : {}),
              },
            });
          }}
        >
          <label>
            Charge type
            <select
              name="kind"
              value={kind}
              onChange={(e) =>
                setKind(e.target.value as (typeof CHARGE_KINDS)[number])
              }
            >
              {CHARGE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {label(k)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Amount (GHS)
            <input
              key={kind}
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={
                presets[kind] ? (presets[kind] / 100).toFixed(2) : ""
              }
              required
            />
          </label>
          <label>
            Reason
            <textarea name="reason" required minLength={5} maxLength={1000} />
          </label>
          <label>
            Evidence reference (optional)
            <input
              name="evidence"
              maxLength={500}
              placeholder="Photo file name, receipt or inspection note"
            />
          </label>
          <button className="button small" disabled={busy}>
            Propose charge
          </button>
          <button type="button" disabled={busy} onClick={() => setForm("")}>
            Close
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
