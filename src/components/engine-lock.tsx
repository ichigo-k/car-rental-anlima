"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
type Outcome = {
  action: "cut" | "restore";
  state: "DONE" | "FAILED" | "WAITING" | "CANCELLED";
  reply: string | null;
};
const STATE_TEXT: Record<Outcome["state"], string> = {
  DONE: "carried out by the tracker",
  FAILED: "failed on the tracker",
  WAITING: "waiting for the tracker",
  CANCELLED: "cancelled",
};
// Cuts or restores a car's fuel/power through its tracker relay. The latest
// command sent decides which button shows; after sending, the tracker's reply
// is checked every 5 seconds for up to 2 minutes.
export function EngineLock({
  vehicleId,
  carName,
  cut,
  rental,
}: {
  vehicleId: string;
  carName: string;
  cut: boolean;
  rental: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [polling, setPolling] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const action = cut ? "restore" : "cut";

  useEffect(() => {
    if (!polling) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      const res = await fetch(`/api/admin/gps/${vehicleId}/immobilise`).catch(
        () => null,
      );
      const json = res?.ok ? await res.json() : null;
      if (json?.outcome) setOutcome(json.outcome);
      if (tries >= 24 || (json?.outcome && json.outcome.state !== "WAITING")) {
        setPolling(false);
        router.refresh();
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [polling, vehicleId, router]);

  async function send() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/gps/${vehicleId}/immobilise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError(
        (await res?.json().catch(() => null))?.error ??
          "The command could not be sent.",
      );
      return;
    }
    setOpen(false);
    setReason("");
    setOutcome({ action, state: "WAITING", reply: null });
    setPolling(true);
    router.refresh();
  }

  return (
    <div className="engine-lock">
      {cut && <span className="gps-state gps-state--offline">Engine cut</span>}
      {!open && (
        <button
          type="button"
          className={`button small secondary${cut ? "" : " danger"}`}
          onClick={() => setOpen(true)}
          disabled={busy || polling}
        >
          {cut ? "Restore engine" : "Immobilise"}
        </button>
      )}
      {open && (
        <div
          className="engine-lock-confirm"
          role="group"
          aria-label={`${cut ? "Restore" : "Immobilise"} ${carName}`}
        >
          <p>
            {cut
              ? `Restore fuel and power to ${carName} so it can be started again.`
              : `Cut fuel and power to ${carName}. It will not start until the engine is restored. The command is only sent while the car is stopped.`}
            {!cut && rental && (
              <strong> This car is on rental {rental}.</strong>
            )}
          </p>
          <label>
            Reason (recorded in the audit log)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={300}
            />
          </label>
          <div className="staff-actions">
            <button
              type="button"
              className={`button small${cut ? "" : " danger"}`}
              disabled={busy || reason.trim().length < 5}
              onClick={send}
            >
              {busy ? "Sending…" : cut ? "Restore engine" : "Cut engine"}
            </button>
            <button
              type="button"
              className="button small secondary"
              onClick={() => {
                setOpen(false);
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="engine-lock-error" role="alert">
          {error}
        </p>
      )}
      {outcome && (
        <small role="status">
          {outcome.action === "cut" ? "Cut-off" : "Restore"}{" "}
          {STATE_TEXT[outcome.state]}
          {outcome.reply ? `: “${outcome.reply}”` : ""}
          {polling ? "…" : ""}
        </small>
      )}
    </div>
  );
}
