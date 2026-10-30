import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { gpsProvider } from "@/lib/gps";
import { NavigationArrow } from "@/components/icons";
export const dynamic = "force-dynamic";
export default async function Tracking() {
  const current = await requireStaff();
  if (!["ADMIN", "MANAGER", "FLEET"].includes(current.user.role))
    return <p>Tracking access is restricted.</p>;
  const cars = await db.vehicle.findMany();
  const positions = await gpsProvider.positions(cars.map((c) => c.id));
  return (
    <>
      <div className="admin-top">
        <div>
          <p className="eyebrow">FLEET VISIBILITY</p>
          <h1>Every drive, in view.</h1>
        </div>
        <span className="status">MOCK GPS</span>
      </div>
      <p className="notice">
        Simulated positions for interface development. This schematic is not a
        live map. No tracker is connected.
      </p>
      <div className="gps-grid">
        <div
          className="mock-map"
          aria-label="Schematic of simulated fleet positions"
        >
          <span className="map-label">ACCRA · SIMULATED VIEW</span>
          {cars.map((c, i) => (
            <span
              className="map-pin"
              key={c.id}
              style={{ left: `${12 + i * 17}%`, top: `${28 + (i % 2) * 24}%` }}
            >
              <NavigationArrow size={15} />
              {c.name.split(" ").slice(-1)}
            </span>
          ))}
          <span className="map-footer">
            Provider adapter ready for future integration
          </span>
        </div>
        <div className="admin-panel" style={{ marginTop: 0 }}>
          <h2>Vehicle positions</h2>
          {cars.map((c, i) => (
            <div className="benefit" key={c.id}>
              <div>
                <h3>{c.name}</h3>
                <p>
                  {positions[i].latitude.toFixed(4)},{" "}
                  {positions[i].longitude.toFixed(4)}
                </p>
                <span className="status">SIMULATED · NO LIVE SIGNAL</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
