"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Fees } from "@/lib/fees";
const ghs = (pesewas: number) => (pesewas / 100).toFixed(2);
const pesewas = (value: FormDataEntryValue | null) =>
  Math.round(Number(value) * 100);
const int = (value: FormDataEntryValue | null) => Number(value);
export function FeeSettingsForm({ fees }: { fees: Fees }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="fee-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setMessage("");
        const f = new FormData(e.currentTarget);
        const allowance = String(f.get("dailyKmAllowance") ?? "").trim();
        try {
          const r = await fetch("/api/admin/settings/fees", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lateGraceMinutes: int(f.get("lateGraceMinutes")),
              lateHourPercent: int(f.get("lateHourPercent")),
              discount3Days: int(f.get("discount3Days")),
              discount7Days: int(f.get("discount7Days")),
              discount14Days: int(f.get("discount14Days")),
              discount30Days: int(f.get("discount30Days")),
              deliveryFee: pesewas(f.get("deliveryFee")),
              extraDriverFee: pesewas(f.get("extraDriverFee")),
              driverOvertimeHourly: pesewas(f.get("driverOvertimeHourly")),
              fuelPerQuarter: pesewas(f.get("fuelPerQuarter")),
              cleaningFee: pesewas(f.get("cleaningFee")),
              smokingFee: pesewas(f.get("smokingFee")),
              dailyKmAllowance: allowance ? Number(allowance) : null,
              excessKmFee: pesewas(f.get("excessKmFee")),
              freeCancellationHours: int(f.get("freeCancellationHours")),
              lateCancellationPercent: int(f.get("lateCancellationPercent")),
            }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "Could not save the fees.");
          setMessage("Fees saved. New charges use these values.");
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset>
        <legend>Late return</legend>
        <label>
          Grace period (minutes)
          <input
            name="lateGraceMinutes"
            type="number"
            min="0"
            max="1440"
            defaultValue={fees.lateGraceMinutes}
            required
          />
        </label>
        <label>
          Charge per hour late (% of the daily rate, capped at a day)
          <input
            name="lateHourPercent"
            type="number"
            min="0"
            max="100"
            defaultValue={fees.lateHourPercent}
            required
          />
        </label>
      </fieldset>
      <fieldset>
        <legend>Fuel, cleaning and smoking</legend>
        <label>
          Fuel charge per quarter tank short (GHS)
          <input
            name="fuelPerQuarter"
            type="number"
            min="0"
            step="0.01"
            defaultValue={ghs(fees.fuelPerQuarter)}
            required
          />
        </label>
        <label>
          Cleaning fee (GHS)
          <input
            name="cleaningFee"
            type="number"
            min="0"
            step="0.01"
            defaultValue={ghs(fees.cleaningFee)}
            required
          />
        </label>
        <label>
          Smoking or vaping fee (GHS)
          <input
            name="smokingFee"
            type="number"
            min="0"
            step="0.01"
            defaultValue={ghs(fees.smokingFee)}
            required
          />
        </label>
      </fieldset>
      <fieldset>
        <legend>Mileage</legend>
        <label>
          Daily allowance (km, leave empty for unlimited)
          <input
            name="dailyKmAllowance"
            type="number"
            min="1"
            max="10000"
            defaultValue={fees.dailyKmAllowance ?? ""}
          />
        </label>
        <label>
          Charge per km over the allowance (GHS)
          <input
            name="excessKmFee"
            type="number"
            min="0"
            step="0.01"
            defaultValue={ghs(fees.excessKmFee)}
            required
          />
        </label>
      </fieldset>
      <fieldset>
        <legend>Discounts for longer rentals (% off the rental)</legend>
        {(
          [
            ["discount3Days", "3 to 6 days"],
            ["discount7Days", "7 to 13 days"],
            ["discount14Days", "14 to 29 days"],
            ["discount30Days", "30 days or more"],
          ] as const
        ).map(([name, label]) => (
          <label key={name}>
            {label}
            <input
              name={name}
              type="number"
              min="0"
              max="100"
              defaultValue={fees[name]}
              required
            />
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Extras and driver service</legend>
        <label>
          Delivery and collection (GHS)
          <input
            name="deliveryFee"
            type="number"
            min="0"
            step="0.01"
            defaultValue={ghs(fees.deliveryFee)}
            required
          />
        </label>
        <label>
          Additional authorised driver, per rental (GHS)
          <input
            name="extraDriverFee"
            type="number"
            min="0"
            step="0.01"
            defaultValue={ghs(fees.extraDriverFee)}
            required
          />
        </label>
        <label>
          Driver overtime, per hour (GHS)
          <input
            name="driverOvertimeHourly"
            type="number"
            min="0"
            step="0.01"
            defaultValue={ghs(fees.driverOvertimeHourly)}
            required
          />
        </label>
        <p className="field-hint">
          Each car&apos;s with-driver daily rate is set on the car itself (Cars
          &amp; availability).
        </p>
      </fieldset>
      <fieldset>
        <legend>Cancellation</legend>
        <label>
          Free cancellation up to (hours before pickup)
          <input
            name="freeCancellationHours"
            type="number"
            min="0"
            max="8760"
            defaultValue={fees.freeCancellationHours}
            required
          />
        </label>
        <label>
          After that, keep (% of the rental amount)
          <input
            name="lateCancellationPercent"
            type="number"
            min="0"
            max="100"
            defaultValue={fees.lateCancellationPercent}
            required
          />
        </label>
      </fieldset>
      <button className="button" disabled={busy}>
        {busy ? "Saving…" : "Save fees"}
      </button>
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
