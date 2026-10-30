"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function VehicleBlock({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return open ? (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        try {
          const r = await fetch(`/api/admin/vehicles/${id}/blocks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              start: new Date(String(f.get("start"))).toISOString(),
              end: new Date(String(f.get("end"))).toISOString(),
              reason: f.get("reason"),
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
        Block start
        <input type="datetime-local" name="start" required />
      </label>
      <label>
        Block end
        <input type="datetime-local" name="end" required />
      </label>
      <label>
        Reason
        <input name="reason" required minLength={5} />
      </label>
      <button className="button small" disabled={busy}>
        {busy ? "Saving…" : "Create block"}
      </button>
      <button type="button" disabled={busy} onClick={() => setOpen(false)}>
        Close
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  ) : (
    <button
      className="text-link"
      style={{ display: "block", marginTop: 10 }}
      onClick={() => setOpen(true)}
    >
      Block dates
    </button>
  );
}
