"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function FleetEditor({
  car,
}: {
  car: {
    id: string;
    name: string;
    category: string;
    seats: number;
    image: string;
    description: string;
    status: string;
    dailyRate: number;
    deposit: number;
    pickupPoints: string[];
  };
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  if (!open)
    return (
      <button
        className="button secondary small"
        aria-expanded={false}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        Edit vehicle
      </button>
    );
  return (
    <form
      className="stack admin-edit-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        try {
          const response = await fetch(`/api/admin/vehicles/${car.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: f.get("name"),
              category: f.get("category"),
              seats: Number(f.get("seats")),
              image: f.get("image"),
              description: f.get("description"),
              status: f.get("status"),
              dailyRate: Math.round(Number(f.get("rate")) * 100),
              deposit: Math.round(Number(f.get("deposit")) * 100),
              pickupPoints: String(f.get("pickupPoints"))
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean),
            }),
          });
          const data = await response.json();
          if (!response.ok)
            throw new Error(data.error || "Could not save this vehicle.");
          setOpen(false);
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Edit {car.name}</h3>
      <div className="admin-form-grid">
        <label>
          Vehicle name
          <input
            name="name"
            required
            minLength={3}
            maxLength={120}
            defaultValue={car.name}
          />
        </label>
        <label>
          Category
          <select name="category" defaultValue={car.category}>
            {["Premium SUV", "Compact SUV", "Luxury sedan", "Sedan"].map(
              (c) => (
                <option key={c}>{c}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Seats
          <input
            name="seats"
            type="number"
            min={2}
            max={15}
            required
            defaultValue={car.seats}
          />
        </label>
        <label>
          Availability
          <select name="status" defaultValue={car.status}>
            <option value="AVAILABLE">Available in catalogue</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>
        <label>
          Daily rate (GHS)
          <input
            name="rate"
            type="number"
            min="1"
            step=".01"
            required
            defaultValue={car.dailyRate / 100}
          />
        </label>
        <label>
          Refundable deposit (GHS)
          <input
            name="deposit"
            type="number"
            min="0"
            step=".01"
            required
            defaultValue={car.deposit / 100}
          />
        </label>
        <label className="wide-field">
          Vehicle image (HTTPS URL)
          <input name="image" type="url" required defaultValue={car.image} />
        </label>
        <label className="wide-field">
          Description
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={2000}
            defaultValue={car.description}
          />
        </label>
        <label className="wide-field">
          Allowed pickup points · one per line
          <textarea
            name="pickupPoints"
            required
            rows={3}
            defaultValue={car.pickupPoints.join("\n")}
          />
        </label>
      </div>
      <p className="field-hint">
        Rate changes apply to new quotes. Existing reservations keep their
        agreed price.
      </p>
      <div className="admin-form-actions">
        <button className="button small" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
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
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
