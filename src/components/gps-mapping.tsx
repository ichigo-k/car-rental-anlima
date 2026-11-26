"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function GpsMapping({
  cars,
  devices,
}: {
  cars: { id: string; name: string; imei: string | null }[];
  devices: { imei: string; label: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const linked = new Set(cars.map((c) => c.imei).filter(Boolean));
  async function link(vehicleId: string, imei: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/gps/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId, imei: imei || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not link the tracker.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="gps-mapping">
      {cars.map((car) => (
        <label key={car.id}>
          {car.name}
          <select
            value={car.imei ?? ""}
            disabled={busy}
            onChange={(e) => void link(car.id, e.target.value)}
          >
            <option value="">No tracker</option>
            {devices
              .filter((d) => d.imei === car.imei || !linked.has(d.imei))
              .map((d) => (
                <option key={d.imei} value={d.imei}>
                  {d.label ? `${d.label} (…${d.imei.slice(-4)})` : d.imei}
                </option>
              ))}
          </select>
        </label>
      ))}
      {!devices.length && (
        <p className="muted">
          No trackers were found on the Tracksolid account.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
