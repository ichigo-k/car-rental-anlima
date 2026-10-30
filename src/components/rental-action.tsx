"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function RentalAction({ id, kind }: { id: string; kind: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div style={{ minWidth: 200, whiteSpace: "normal", marginTop: 10 }}>
      {!open ? (
        <button className="button small" onClick={() => setOpen(true)}>
          {kind === "CHECKOUT" ? "Record handover" : "Record return"}
        </button>
      ) : (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              const r = await fetch(`/api/admin/rentals/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  kind,
                  mileage: Number(f.get("mileage")),
                  fuel: f.get("fuel"),
                  condition: f.get("condition"),
                  acknowledgement: f.get("acknowledgement"),
                }),
              });
              const d = await r.json();
              if (!r.ok) {
                throw new Error(d.error || "Could not save the inspection.");
              }
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
            Mileage (km)
            <input name="mileage" type="number" min="0" required />
          </label>
          <label>
            Fuel level
            <select name="fuel">
              <option>Full</option>
              <option>Three quarters</option>
              <option>Half</option>
              <option>Quarter</option>
              <option>Empty</option>
            </select>
          </label>
          <label>
            Condition notes
            <textarea name="condition" required minLength={5} />
          </label>
          <label>
            Customer acknowledgement
            <input
              name="acknowledgement"
              placeholder="Acknowledgement reference / signed name"
              required
              minLength={3}
            />
          </label>
          <button className="button small" disabled={busy}>
            Save inspection
          </button>
          <button type="button" disabled={busy} onClick={() => setOpen(false)}>
            Close
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </div>
  );
}
