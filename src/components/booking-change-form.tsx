"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/catalogue";

type Preview = {
  available: boolean;
  problem: string | null;
  vehicle: string;
  days: number;
  dailyRate: number;
  difference: number;
  depositHeld: number;
  carDeposit: number;
};
// Accra is on GMT all year, so a datetime-local value is a UTC time.
const toInput = (iso: string) => iso.slice(0, 16);
const toIso = (value: string) => new Date(`${value}:00.000Z`).toISOString();

// Staff change to a booking's car or dates (Guide AC-05): check availability
// and the price difference first, then confirm with a reason.
export function BookingChangeForm({
  id,
  onRoad,
  vehicleId,
  pickup,
  returnAt,
  cars,
  onClose,
}: {
  id: string;
  onRoad: boolean;
  vehicleId: string;
  pickup: string;
  returnAt: string;
  cars: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState({
    vehicleId,
    pickup: toInput(pickup),
    returnAt: toInput(returnAt),
  });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (patch: Partial<typeof draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setPreview(null);
  };
  async function send(extra: object) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/bookings/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CHANGE",
          vehicleId: draft.vehicleId,
          pickup: toIso(draft.pickup),
          returnAt: toIso(draft.returnAt),
          ...extra,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not change this booking.");
      return d.change as Preview;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="stack booking-change"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!preview) {
          setPreview(await send({ preview: true }));
          return;
        }
        const f = new FormData(e.currentTarget);
        const done = await send({
          reason: String(f.get("reason") ?? ""),
          chargeDifference: f.get("chargeDifference") === "on",
        });
        if (done) {
          onClose();
          router.refresh();
        }
      }}
    >
      <h3>{onRoad ? "Change the return time" : "Change car or dates"}</h3>
      {!onRoad && (
        <label>
          Car
          <select
            value={draft.vehicleId}
            onChange={(e) => update({ vehicleId: e.target.value })}
          >
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!onRoad && (
        <label>
          Pickup (Ghana time)
          <input
            type="datetime-local"
            value={draft.pickup}
            onChange={(e) => update({ pickup: e.target.value })}
            required
          />
        </label>
      )}
      <label>
        Return (Ghana time)
        <input
          type="datetime-local"
          value={draft.returnAt}
          onChange={(e) => update({ returnAt: e.target.value })}
          required
        />
      </label>
      {preview && !preview.available && (
        <p className="error">{preview.problem}</p>
      )}
      {preview?.available && (
        <div className="change-preview">
          <p>
            <strong>Available.</strong> {preview.vehicle}, {preview.days} day
            {preview.days === 1 ? "" : "s"} at {money(preview.dailyRate)}/day.
          </p>
          <p>
            {preview.difference > 0
              ? `The new arrangement costs ${money(preview.difference)} more than the customer paid for.`
              : preview.difference < 0
                ? `The new arrangement costs ${money(-preview.difference)} less. This credit is recorded for the customer.`
                : "The price is the same as before."}
          </p>
          {preview.carDeposit > preview.depositHeld && (
            <p className="muted">
              This car normally needs a {money(preview.carDeposit)} deposit;{" "}
              {money(preview.depositHeld)} is held for this booking.
            </p>
          )}
          {preview.difference > 0 && (
            <label className="check">
              <input type="checkbox" name="chargeDifference" defaultChecked />
              Add {money(preview.difference)} as a charge, settled at return
            </label>
          )}
          <label>
            Reason for the change
            <textarea name="reason" required minLength={5} maxLength={500} />
          </label>
        </div>
      )}
      <button
        className="button small"
        disabled={busy || (!!preview && !preview.available)}
      >
        {preview?.available ? "Confirm change" : "Check availability"}
      </button>
      <button type="button" disabled={busy} onClick={onClose}>
        Close
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
