"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GpsPosition, RoutePoint } from "@/lib/gps";
import { drawFence, type FenceShape } from "@/lib/geofence-shapes";

type Car = { id: string; name: string; linked: boolean };
type Period = "today" | "24h" | "72h";
const POLL_MS = 15000;
const ACCRA: [number, number] = [5.6037, -0.187];
const COLOURS: Record<GpsPosition["freshness"], string> = {
  LIVE: "#12a150",
  STALE: "#d49b00",
  NO_FIX: "#d49b00",
  OFFLINE: "#c0392b",
};
const STATE_LABEL: Record<GpsPosition["freshness"], string> = {
  LIVE: "Live",
  STALE: "Stale",
  OFFLINE: "Tracker offline",
  NO_FIX: "No GPS fix",
};
const clock = (iso: string | null, withDate = true) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        timeZone: "Africa/Accra",
        ...(withDate ? { dateStyle: "medium" } : {}),
        timeStyle: "short",
      })
    : "—";
function periodStart(period: Period) {
  if (period === "24h") return new Date(Date.now() - 24 * 3600000);
  if (period === "72h") return new Date(Date.now() - 72 * 3600000);
  // Midnight in Accra (UTC+0 all year).
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function carIcon(L: typeof Leaflet, name: string, p: GpsPosition) {
  const rotate = p.heading ?? 0;
  const arrow =
    p.heading !== null && p.freshness === "LIVE" && (p.speedKmh ?? 0) > 0;
  return L.divIcon({
    className: "fleet-marker",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<span class="fleet-marker-dot" style="background:${COLOURS[p.freshness]}">${
      arrow
        ? `<svg viewBox="0 0 24 24" style="transform:rotate(${rotate}deg)"><path d="M12 3l6 15-6-4-6 4z" fill="#fff"/></svg>`
        : ""
    }</span><span class="fleet-marker-name">${name.replace(/[<>&"]/g, "")}</span>`,
  });
}

export function FleetLiveMap({
  cars,
  initialCarId,
  fences = [],
}: {
  cars: Car[];
  initialCarId?: string;
  fences?: FenceShape[];
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const leaflet = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const markers = useRef(new Map<string, Leaflet.Marker>());
  const routeLayer = useRef<Leaflet.LayerGroup | null>(null);
  const fenceLayer = useRef<Leaflet.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const playMarker = useRef<Leaflet.CircleMarker | null>(null);
  const fitted = useRef(false);
  const [positions, setPositions] = useState<GpsPosition[]>([]);
  const [source, setSource] = useState<string>("");
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [selected, setSelected] = useState(
    cars.find((c) => c.id === initialCarId && c.linked)?.id ?? "",
  );
  const [follow, setFollow] = useState(true);
  const [period, setPeriod] = useState<Period>("today");
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [routeState, setRouteState] = useState("");
  const [playback, setPlayback] = useState<number | null>(null);
  const names = new Map(cars.map((c) => [c.id, c.name]));
  const current = positions.find((p) => p.vehicleId === selected);

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/gps", { cache: "no-store" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Positions could not load.");
      setPositions(body.positions);
      setSource(body.source);
      setError(body.error ?? "");
      setUpdatedAt(new Date());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !mapEl.current || map.current) return;
      leaflet.current = L;
      map.current = L.map(mapEl.current, { zoomControl: true }).setView(
        ACCRA,
        12,
      );
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map.current);
      fenceLayer.current = L.layerGroup().addTo(map.current);
      routeLayer.current = L.layerGroup().addTo(map.current);
      setMapReady(true);
      void poll();
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      markers.current.clear();
    };
  }, [poll]);

  // Geofences drawn by staff, under the cars and routes.
  useEffect(() => {
    const L = leaflet.current;
    const layer = fenceLayer.current;
    if (!mapReady || !L || !layer) return;
    layer.clearLayers();
    for (const fence of fences) drawFence(L, layer, fence);
  }, [mapReady, fences]);

  // Refresh positions every 15 seconds while the tab is visible.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) void poll();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  // Draw car markers.
  useEffect(() => {
    const L = leaflet.current;
    const m = map.current;
    if (!L || !m) return;
    const seen = new Set<string>();
    for (const p of positions) {
      if (p.latitude === null || p.longitude === null) continue;
      seen.add(p.vehicleId);
      const icon = carIcon(L, names.get(p.vehicleId) ?? "Car", p);
      const existing = markers.current.get(p.vehicleId);
      if (existing) existing.setLatLng([p.latitude, p.longitude]).setIcon(icon);
      else
        markers.current.set(
          p.vehicleId,
          L.marker([p.latitude, p.longitude], { icon })
            .on("click", () => setSelected(p.vehicleId))
            .addTo(m),
        );
    }
    for (const [id, marker] of markers.current)
      if (!seen.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    if (!fitted.current && seen.size) {
      fitted.current = true;
      const points = [...markers.current.values()].map((mk) => mk.getLatLng());
      if (points.length === 1) m.setView(points[0], 15);
      else m.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }
  }, [positions]);

  // Keep the followed car in view, and extend its route as it moves.
  useEffect(() => {
    if (!current || current.latitude === null || current.longitude === null)
      return;
    if (follow && playback === null)
      map.current?.panTo([current.latitude, current.longitude]);
    setRoute((r) => {
      const last = r.at(-1);
      if (
        !current.recordedAt ||
        (last && last.recordedAt >= current.recordedAt)
      )
        return r;
      return [
        ...r,
        {
          latitude: current.latitude!,
          longitude: current.longitude!,
          recordedAt: current.recordedAt,
          speedKmh: current.speedKmh,
          heading: current.heading,
        },
      ];
    });
  }, [current, follow, playback]);

  // Load the selected car's recorded route.
  useEffect(() => {
    setRoute([]);
    setPlayback(null);
    if (!selected) return;
    const controller = new AbortController();
    setRouteState("Loading route…");
    const params = new URLSearchParams({
      from: periodStart(period).toISOString(),
      to: new Date().toISOString(),
    });
    fetch(`/api/admin/gps/${selected}?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Route could not load.");
        setRoute(body.points);
        setRouteState(
          body.points.length ? "" : "No movement recorded in this period.",
        );
      })
      .catch((e) => {
        if (!controller.signal.aborted) setRouteState((e as Error).message);
      });
    return () => controller.abort();
  }, [selected, period]);

  // Draw the route and playback marker.
  useEffect(() => {
    const L = leaflet.current;
    const layer = routeLayer.current;
    if (!L || !layer) return;
    layer.clearLayers();
    playMarker.current = null;
    if (route.length < 2) return;
    const line = route.map((p) => [p.latitude, p.longitude]) as [
      number,
      number,
    ][];
    L.polyline(line, { color: "#012d5a", weight: 4, opacity: 0.75 }).addTo(
      layer,
    );
    L.circleMarker(line[0], {
      radius: 6,
      color: "#fff",
      weight: 2,
      fillColor: "#b18a22",
      fillOpacity: 1,
    })
      .bindTooltip(`Start · ${clock(route[0].recordedAt)}`)
      .addTo(layer);
    if (playback !== null) {
      const p = route[playback];
      playMarker.current = L.circleMarker([p.latitude, p.longitude], {
        radius: 8,
        color: "#fff",
        weight: 3,
        fillColor: "#b18a22",
        fillOpacity: 1,
      }).addTo(layer);
    }
  }, [route, playback]);

  // Move the playback marker without redrawing the route.
  useEffect(() => {
    if (playback === null || !route[playback]) return;
    const p = route[playback];
    playMarker.current?.setLatLng([p.latitude, p.longitude]);
    map.current?.panTo([p.latitude, p.longitude], { animate: false });
  }, [playback, route]);

  function choose(id: string) {
    setSelected(id);
    setFollow(true);
    const p = positions.find((x) => x.vehicleId === id);
    if (p?.latitude != null && p.longitude != null)
      map.current?.setView([p.latitude, p.longitude], 16);
  }

  const shown = playback !== null ? route[playback] : null;
  return (
    <section className="admin-panel fleet-live" id="live-map">
      <div className="fleet-live-head">
        <h2>Live map</h2>
        <span className="muted">
          {source === "mock"
            ? "Simulated positions"
            : updatedAt
              ? `Updated ${clock(updatedAt.toISOString(), false)} · refreshes every 15 seconds`
              : "Loading positions…"}
        </span>
      </div>
      {error && (
        <p className="admin-callout" role="alert">
          {error}
        </p>
      )}
      <div className="fleet-live-body">
        <div ref={mapEl} className="fleet-live-map" />
        <aside className="fleet-live-side">
          <ul className="fleet-live-cars">
            {cars
              .filter((c) => c.linked)
              .map((c) => {
                const p = positions.find((x) => x.vehicleId === c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-pressed={selected === c.id}
                      onClick={() => choose(c.id)}
                    >
                      <span
                        className="fleet-live-dot"
                        style={{
                          background: p ? COLOURS[p.freshness] : "#9aa5b1",
                        }}
                      />
                      <strong>{c.name}</strong>
                      <small>
                        {p
                          ? `${STATE_LABEL[p.freshness]}${
                              p.speedKmh
                                ? ` · ${Math.round(p.speedKmh)} km/h`
                                : ""
                            }`
                          : "No data"}
                      </small>
                    </button>
                  </li>
                );
              })}
          </ul>
          {!cars.some((c) => c.linked) && (
            <p className="muted">
              No trackers are linked yet. Link them below to see cars here.
            </p>
          )}
          {selected && (
            <div className="fleet-live-detail">
              <h3>{names.get(selected)}</h3>
              {current && (
                <dl>
                  <dt>Status</dt>
                  <dd>{STATE_LABEL[current.freshness]}</dd>
                  <dt>Speed</dt>
                  <dd>
                    {current.speedKmh !== null
                      ? `${Math.round(current.speedKmh)} km/h`
                      : "—"}
                  </dd>
                  <dt>Ignition</dt>
                  <dd>
                    {current.ignitionOn === null
                      ? "—"
                      : current.ignitionOn
                        ? "On"
                        : "Off"}
                  </dd>
                  <dt>Position</dt>
                  <dd>{clock(current.recordedAt)}</dd>
                </dl>
              )}
              <label className="fleet-live-check">
                <input
                  type="checkbox"
                  checked={follow}
                  onChange={(e) => setFollow(e.target.checked)}
                />
                Follow this car on the map
              </label>
              <label>
                Route
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as Period)}
                >
                  <option value="today">Today</option>
                  <option value="24h">Last 24 hours</option>
                  <option value="72h">Last 3 days</option>
                </select>
              </label>
              {routeState && <p className="muted">{routeState}</p>}
              {route.length > 1 && (
                <div className="fleet-live-playback">
                  <label>
                    Replay route
                    <input
                      type="range"
                      min={0}
                      max={route.length - 1}
                      value={playback ?? route.length - 1}
                      onChange={(e) => setPlayback(Number(e.target.value))}
                    />
                  </label>
                  <small>
                    {shown
                      ? `${clock(shown.recordedAt)}${
                          shown.speedKmh !== null
                            ? ` · ${Math.round(shown.speedKmh)} km/h`
                            : ""
                        }`
                      : `${route.length} points · drag to replay`}
                  </small>
                  {playback !== null && (
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => setPlayback(null)}
                    >
                      Back to live
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
