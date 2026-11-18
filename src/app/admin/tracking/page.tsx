import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  fleetPositions,
  STALE_AFTER_MINUTES,
  type GpsPosition,
} from "@/lib/gps";
import { listDevices, tracksolidConfig } from "@/lib/tracksolid";
import { can } from "@/lib/permissions";
import { GpsMapping } from "@/components/gps-mapping";
import { FleetLiveMap } from "@/components/fleet-live-map";
export const dynamic = "force-dynamic";
const label: Record<GpsPosition["freshness"], string> = {
  LIVE: "Live",
  STALE: "Stale",
  OFFLINE: "Tracker offline",
  NO_FIX: "No GPS fix",
};
const time = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        timeZone: "Africa/Accra",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
export default async function Tracking({
  searchParams,
}: {
  searchParams: Promise<{ car?: string }>;
}) {
  const { car: initialCarId } = await searchParams;
  const current = await requireStaff();
  if (!can(current.user.role, "gps.view"))
    return <p>Tracking access is restricted.</p>;
  const cars = await db.vehicle.findMany({
    select: { id: true, name: true, gpsImei: true },
    orderBy: { name: "asc" },
  });
  const snapshot = await fleetPositions(cars);
  await db.auditEvent.create({
    data: {
      actorId: current.user.id,
      action: "GPS_VIEWED",
      entityId: "fleet-map",
      detail: `${snapshot.source}; ${snapshot.positions.length} vehicle positions`,
    },
  });
  const byVehicle = new Map(snapshot.positions.map((p) => [p.vehicleId, p]));
  const config = tracksolidConfig();
  const canMap = config && can(current.user.role, "vehicle.write");
  const devices = canMap ? await listDevices(config).catch(() => null) : null;
  return (
    <>
      <div className="admin-top">
        <div>
          <p className="eyebrow">FLEET VISIBILITY</p>
          <h1>Fleet tracking</h1>
          <p>
            Last known positions from Tracksolid Pro. A position is marked stale
            when the tracker has not reported for {STALE_AFTER_MINUTES} minutes.
          </p>
        </div>
        <span className="status">
          {snapshot.source === "mock" ? "SIMULATED" : "TRACKSOLID PRO"}
        </span>
      </div>
      {snapshot.source === "mock" && (
        <p className="notice">
          Tracksolid Pro is not connected yet, so these positions are simulated.
          Add the Tracksolid keys to the server environment to show real
          trackers.
        </p>
      )}
      {snapshot.error && (
        <p className="admin-callout" role="alert">
          {snapshot.error}. Positions cannot be shown right now; this is not
          live data.
        </p>
      )}
      <FleetLiveMap
        cars={cars.map((c) => ({
          id: c.id,
          name: c.name,
          linked: !!c.gpsImei,
        }))}
        initialCarId={initialCarId}
      />
      <section className="admin-panel">
        <table className="data-table gps-table">
          <thead>
            <tr>
              <th>Car</th>
              <th>Tracker</th>
              <th>Position recorded</th>
              <th>Last heard</th>
              <th>Speed</th>
              <th>Ignition</th>
              <th>Map</th>
            </tr>
          </thead>
          <tbody>
            {cars.map((car) => {
              const p = byVehicle.get(car.id);
              return (
                <tr key={car.id}>
                  <td>{car.name}</td>
                  <td>
                    {!p ? (
                      <span className="gps-state gps-state--none">
                        {car.gpsImei ? "No data" : "No tracker linked"}
                      </span>
                    ) : (
                      <span
                        className={`gps-state gps-state--${p.freshness.toLowerCase()}`}
                      >
                        {snapshot.source === "mock"
                          ? "Simulated"
                          : label[p.freshness]}
                      </span>
                    )}
                    {car.gpsImei && (
                      <small> · IMEI …{car.gpsImei.slice(-4)}</small>
                    )}
                  </td>
                  <td>{time(p?.recordedAt ?? null)}</td>
                  <td>{time(p?.heartbeatAt ?? null)}</td>
                  <td>
                    {p?.speedKmh !== null && p?.speedKmh !== undefined
                      ? `${Math.round(p.speedKmh)} km/h`
                      : "—"}
                  </td>
                  <td>
                    {p?.ignitionOn === null || p?.ignitionOn === undefined
                      ? "—"
                      : p.ignitionOn
                        ? "On"
                        : "Off"}
                  </td>
                  <td>
                    {p?.latitude !== null && p?.latitude !== undefined ? (
                      <a href={`?car=${car.id}#live-map`}>Track</a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      {canMap && (
        <section className="admin-panel">
          <h2>Link trackers to cars</h2>
          {devices ? (
            <GpsMapping
              cars={cars.map((c) => ({
                id: c.id,
                name: c.name,
                imei: c.gpsImei,
              }))}
              devices={devices.map((d) => ({
                imei: String(d.imei),
                label: [d.deviceName, d.vehicleNumber]
                  .filter(Boolean)
                  .join(" · "),
              }))}
            />
          ) : (
            <p className="muted">
              The tracker list could not be loaded from Tracksolid. Try again
              shortly.
            </p>
          )}
        </section>
      )}
    </>
  );
}
