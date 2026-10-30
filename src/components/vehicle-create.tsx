"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function VehicleCreate() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <>
      {!open ? (
        <button className="button small" onClick={() => setOpen(true)}>
          Add vehicle
        </button>
      ) : (
        <section className="admin-panel">
          <h2>Add a vehicle</h2>
          <form
            className="stack admin-form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                const r = await fetch("/api/admin/vehicles", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: f.get("name"),
                    slug: f.get("slug"),
                    category: f.get("category"),
                    seats: Number(f.get("seats")),
                    dailyRate: Math.round(Number(f.get("rate")) * 100),
                    deposit: Math.round(Number(f.get("deposit")) * 100),
                    image: f.get("image"),
                    description: f.get("description"),
                    pickupPoints: String(f.get("pickupPoints"))
                      .split(/\r?\n/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }),
                });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error);
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
              Vehicle name
              <input name="name" required minLength={3} />
            </label>
            <label>
              Unique public URL slug
              <input
                name="slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                placeholder="toyota-camry-01"
              />
            </label>
            <label>
              Category
              <select name="category">
                <option>Premium SUV</option>
                <option>Compact SUV</option>
                <option>Luxury sedan</option>
                <option>Sedan</option>
              </select>
            </label>
            <label>
              Seats
              <input
                name="seats"
                type="number"
                required
                min="2"
                max="15"
                defaultValue="5"
              />
            </label>
            <label>
              Daily rate (GHS)
              <input name="rate" type="number" min="1" step=".01" required />
            </label>
            <label>
              Deposit (GHS)
              <input name="deposit" type="number" min="0" step=".01" required />
            </label>
            <label>
              Vehicle image (HTTPS URL)
              <input name="image" type="url" required />
            </label>
            <label>
              Description
              <textarea name="description" required minLength={10} />
            </label>
            <label>
              Allowed pickup points (one per line)
              <textarea
                name="pickupPoints"
                required
                rows={3}
                defaultValue={"Accra · Airport pickup\nAccra · City pickup"}
              />
            </label>
            <button className="button" disabled={busy}>
              {busy ? "Saving…" : "Save vehicle"}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Close
            </button>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </form>
        </section>
      )}
    </>
  );
}
