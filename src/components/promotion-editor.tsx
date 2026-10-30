"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export type PromotionRecord = {
  id: string;
  name: string;
  code: string | null;
  discountType: string;
  value: number;
  vehicleIds: string[];
  minimumRental: number;
  maxUses: number | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
};
export function PromotionEditor({
  vehicles,
  promotion,
}: {
  vehicles: { id: string; name: string }[];
  promotion?: PromotionRecord;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(promotion?.discountType ?? "PERCENT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  if (!open)
    return (
      <button
        className={`button ${promotion ? "secondary " : ""}small`}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        {promotion ? "Edit promotion" : "Create promotion"}
      </button>
    );
  return (
    <section className="admin-panel promotion-editor">
      <h2>{promotion ? "Edit promotion" : "Create a promotion or voucher"}</h2>
      <p className="field-hint">
        Leave the coupon code empty for an automatic discount. One offer per
        reservation; offers never reduce the refundable deposit. A minimum
        rental charge of GH₵1 remains. Offer dates control when customers
        reserve, rather than when they travel.
      </p>
      <form
        className="admin-form-grid stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            const r = await fetch(
              promotion
                ? `/api/admin/promotions/${promotion.id}`
                : "/api/admin/promotions",
              {
                method: promotion ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: f.get("name"),
                  code: String(f.get("code")).trim().toUpperCase() || null,
                  discountType: type,
                  value:
                    type === "PERCENT"
                      ? Number(f.get("value"))
                      : Math.round(Number(f.get("value")) * 100),
                  minimumRental: Math.round(
                    Number(f.get("minimumRental")) * 100,
                  ),
                  maxUses: String(f.get("maxUses"))
                    ? Number(f.get("maxUses"))
                    : null,
                  vehicleIds: f.getAll("vehicleIds"),
                  startsAt: new Date(`${f.get("startsAt")}:00Z`).toISOString(),
                  endsAt: new Date(`${f.get("endsAt")}:00Z`).toISOString(),
                  active: f.get("active") === "on",
                }),
              },
            );
            const d = await r.json();
            if (!r.ok)
              throw new Error(d.error || "Could not save this promotion.");
            setOpen(false);
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Promotion name
          <input
            name="name"
            required
            minLength={3}
            maxLength={100}
            defaultValue={promotion?.name}
            placeholder="Weekend drive offer"
          />
        </label>
        <label>
          Coupon / voucher code · optional
          <input
            name="code"
            pattern="[A-Za-z0-9-]{3,40}"
            maxLength={40}
            defaultValue={promotion?.code ?? ""}
            placeholder="e.g. DRIVE15"
          />
        </label>
        <label>
          Discount type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="PERCENT">Percentage off rental</option>
            <option value="FIXED">Fixed amount off rental</option>
          </select>
        </label>
        <label>
          {type === "PERCENT"
            ? "Discount percentage (1–90%)"
            : "Discount amount (GHS)"}
          <input
            key={type}
            name="value"
            type="number"
            required
            min={1}
            max={type === "PERCENT" ? 90 : 1000000}
            step={type === "PERCENT" ? 1 : 0.01}
            defaultValue={
              promotion && promotion.discountType === type
                ? type === "PERCENT"
                  ? promotion.value
                  : promotion.value / 100
                : 10
            }
          />
        </label>
        <label>
          Starts · Ghana time
          <input
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={
              promotion?.startsAt.slice(0, 16) ??
              new Date().toISOString().slice(0, 16)
            }
          />
        </label>
        <label>
          Ends · Ghana time
          <input
            name="endsAt"
            type="datetime-local"
            required
            defaultValue={promotion?.endsAt.slice(0, 16)}
          />
        </label>
        <label>
          Minimum rental charge (GHS)
          <input
            name="minimumRental"
            type="number"
            min={0}
            step=".01"
            required
            defaultValue={(promotion?.minimumRental ?? 0) / 100}
          />
        </label>
        <label>
          Maximum uses · optional
          <input
            name="maxUses"
            type="number"
            min={1}
            max={1000000}
            defaultValue={promotion?.maxUses ?? ""}
            placeholder="Unlimited"
          />
        </label>
        <fieldset className="wide-field promotion-car-options">
          <legend>
            Eligible cars · leave all unchecked for the whole fleet
          </legend>
          {vehicles.map((car) => (
            <label key={car.id}>
              <input
                type="checkbox"
                name="vehicleIds"
                value={car.id}
                defaultChecked={promotion?.vehicleIds.includes(car.id)}
              />
              {car.name}
            </label>
          ))}
        </fieldset>
        <label className="promotion-active wide-field">
          <input
            type="checkbox"
            name="active"
            defaultChecked={promotion?.active ?? true}
          />
          Enabled · uncheck to pause this offer
        </label>
        <div className="admin-form-actions wide-field">
          <button className="button small" disabled={busy}>
            {busy ? "Saving…" : "Save promotion"}
          </button>
          <button
            type="button"
            className="button secondary small"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </div>
        {error && (
          <p className="error wide-field" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
