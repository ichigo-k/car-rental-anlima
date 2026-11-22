"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { drawFence, type FenceShape } from "@/lib/geofence-shapes";

export type Fence = FenceShape & {
  id: string;
  vehicleIds: string[];
  appliesWhen: string;
  active: boolean;
};
type Car = { id: string; name: string };
const ACCRA: [number, number] = [5.6037, -0.187];
const blank = (): Omit<Fence, "id"> => ({
  name: "",
  kind: "ALLOWED",
  shape: "POLYGON",
  centerLat: null,
  centerLng: null,
  radiusM: 5000,
  points: [],
  vehicleIds: [],
  appliesWhen: "ON_RENTAL",
  active: true,
});

// Staff draw and edit geofences: click the map to place a circle or outline
// an area, then choose who it applies to.
function Editor({
  cars,
  fences,
  initial,
  onClose,
}: {
  cars: Car[];
  fences: Fence[];
  initial: Fence | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const mapEl = useRef<HTMLDivElement>(null);
  const leaflet = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const draft = useRef<Leaflet.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);
  const [f, setF] = useState<Omit<Fence, "id">>(initial ?? blank());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shapeRef = useRef(f.shape);
  shapeRef.current = f.shape;

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !mapEl.current || map.current) return;
      leaflet.current = L;
      const m = L.map(mapEl.current).setView(ACCRA, 10);
      map.current = m;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      const others = L.layerGroup().addTo(m);
      for (const other of fences)
        if (other.id !== initial?.id) drawFence(L, others, other, true);
      draft.current = L.layerGroup().addTo(m);
      m.on("click", (e: Leaflet.LeafletMouseEvent) => {
        const point: [number, number] = [
          Math.round(e.latlng.lat * 1e6) / 1e6,
          Math.round(e.latlng.lng * 1e6) / 1e6,
        ];
        setF((v) =>
          shapeRef.current === "CIRCLE"
            ? { ...v, centerLat: point[0], centerLng: point[1] }
            : { ...v, points: [...(v.points ?? []), point] },
        );
      });
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [fences, initial?.id]);

  // Redraw the area being edited, and frame it the first time.
  const framed = useRef(false);
  useEffect(() => {
    const L = leaflet.current;
    const layer = draft.current;
    if (!ready || !L || !layer) return;
    layer.clearLayers();
    const shape = drawFence(L, layer, { ...f, name: f.name || "New area" });
    if (f.shape === "POLYGON")
      for (const p of f.points ?? [])
        L.circleMarker(p, { radius: 4, color: "#012d5a", weight: 2 }).addTo(
          layer,
        );
    if (shape && !framed.current) {
      framed.current = true;
      map.current?.fitBounds(shape.getBounds(), { padding: [30, 30] });
    }
  }, [ready, f]);

  async function save() {
    if (f.name.trim().length < 2) {
      setError("Give the geofence a name, e.g. Greater Accra.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        initial ? `/api/admin/geofences/${initial.id}` : "/api/admin/geofences",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(f),
        },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not save the geofence.");
      onClose();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const toggleCar = (id: string) =>
    setF((v) => ({
      ...v,
      vehicleIds: v.vehicleIds.includes(id)
        ? v.vehicleIds.filter((c) => c !== id)
        : [...v.vehicleIds, id],
    }));
  return (
    <div className="geofence-editor">
      <div className="geofence-editor-map">
        <div ref={mapEl} />
        <p className="muted">
          {f.shape === "CIRCLE"
            ? "Click the map to place the centre of the circle."
            : `Click the map to outline the area (${f.points?.length ?? 0} point${f.points?.length === 1 ? "" : "s"}; at least 3).`}
        </p>
        {f.shape === "POLYGON" && (
          <div className="geofence-point-actions">
            <button
              type="button"
              className="text-link"
              disabled={!f.points?.length}
              onClick={() =>
                setF((v) => ({ ...v, points: (v.points ?? []).slice(0, -1) }))
              }
            >
              Undo last point
            </button>
            <button
              type="button"
              className="text-link"
              disabled={!f.points?.length}
              onClick={() => setF((v) => ({ ...v, points: [] }))}
            >
              Clear
            </button>
          </div>
        )}
      </div>
      <div className="stack geofence-editor-form">
        <label>
          Name
          <input
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder="e.g. Greater Accra"
            required
            minLength={2}
            maxLength={80}
          />
        </label>
        <label>
          Rule
          <select
            value={f.kind}
            onChange={(e) => setF({ ...f, kind: e.target.value })}
          >
            <option value="ALLOWED">
              Allowed area: alert when a car leaves
            </option>
            <option value="RESTRICTED">
              No-go area: alert when a car enters
            </option>
          </select>
        </label>
        <label>
          Shape
          <select
            value={f.shape}
            onChange={(e) => setF({ ...f, shape: e.target.value })}
          >
            <option value="POLYGON">Area I outline on the map</option>
            <option value="CIRCLE">Circle around a point</option>
          </select>
        </label>
        {f.shape === "CIRCLE" && (
          <label>
            Radius (km)
            <input
              type="number"
              min="0.1"
              max="500"
              step="0.1"
              value={(f.radiusM ?? 0) / 1000}
              onChange={(e) =>
                setF({
                  ...f,
                  radiusM: Math.round(Number(e.target.value) * 1000),
                })
              }
            />
          </label>
        )}
        <label>
          Applies
          <select
            value={f.appliesWhen}
            onChange={(e) => setF({ ...f, appliesWhen: e.target.value })}
          >
            <option value="ON_RENTAL">
              Only while a car is out on a rental
            </option>
            <option value="ALWAYS">Always, including when parked</option>
          </select>
        </label>
        <fieldset className="geofence-cars">
          <legend>Cars (none ticked: all tracked cars)</legend>
          {cars.map((c) => (
            <label key={c.id}>
              <input
                type="checkbox"
                checked={f.vehicleIds.includes(c.id)}
                onChange={() => toggleCar(c.id)}
              />
              {c.name}
            </label>
          ))}
        </fieldset>
        <label className="geofence-active">
          <input
            type="checkbox"
            checked={f.active}
            onChange={(e) => setF({ ...f, active: e.target.checked })}
          />
          Active
        </label>
        <button
          type="button"
          className="button small"
          disabled={busy}
          onClick={save}
        >
          {initial ? "Save changes" : "Create geofence"}
        </button>
        <button type="button" disabled={busy} onClick={onClose}>
          Close
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

export function GeofenceManager({
  fences,
  cars,
}: {
  fences: Fence[];
  cars: Car[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Fence | "new" | null>(null);
  const carName = new Map(cars.map((c) => [c.id, c.name]));
  async function remove(fence: Fence) {
    if (!window.confirm(`Delete "${fence.name}" and its alerts?`)) return;
    await fetch(`/api/admin/geofences/${fence.id}`, { method: "DELETE" });
    router.refresh();
  }
  return (
    <div className="geofence-manager">
      {editing ? (
        <Editor
          cars={cars}
          fences={fences}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : (
        <>
          {fences.length ? (
            <ul className="geofence-list">
              {fences.map((fence) => (
                <li key={fence.id}>
                  <span>
                    <strong>{fence.name}</strong>
                    <small>
                      {fence.kind === "RESTRICTED"
                        ? "No-go area"
                        : "Allowed area"}{" "}
                      ·{" "}
                      {fence.shape === "CIRCLE"
                        ? `${((fence.radiusM ?? 0) / 1000).toFixed(1)} km circle`
                        : `${fence.points?.length ?? 0}-point area`}{" "}
                      ·{" "}
                      {fence.appliesWhen === "ON_RENTAL"
                        ? "on rentals"
                        : "always"}{" "}
                      ·{" "}
                      {fence.vehicleIds.length
                        ? fence.vehicleIds
                            .map((id) => carName.get(id) ?? "Unknown car")
                            .join(", ")
                        : "all tracked cars"}
                      {!fence.active && " · paused"}
                    </small>
                  </span>
                  <span className="geofence-actions">
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => setEditing(fence)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => remove(fence)}
                    >
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              No geofences yet. Add an allowed area (for example Greater Accra)
              or a no-go area.
            </p>
          )}
          <button
            type="button"
            className="button small"
            onClick={() => setEditing("new")}
          >
            Add geofence
          </button>
        </>
      )}
    </div>
  );
}
