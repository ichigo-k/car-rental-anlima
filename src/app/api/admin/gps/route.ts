import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditGpsView, fleetPositions } from "@/lib/gps";
import { evaluateGeofences } from "@/lib/geofences";
export async function GET() {
  let current;
  try {
    current = await requireStaff("gps.view");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const cars = await db.vehicle.findMany({
    select: { id: true, gpsImei: true },
  });
  const snapshot = await fleetPositions(cars);
  // Real tracker data only; simulated positions never raise alerts.
  if (snapshot.source === "tracksolid")
    await evaluateGeofences(db, snapshot.positions).catch(() => 0);
  await auditGpsView(
    current.user.id,
    "gps-api",
    `${snapshot.source}; ${snapshot.positions.length} vehicle positions`,
  );
  return NextResponse.json(
    {
      mock: snapshot.source === "mock",
      source: snapshot.source,
      positions: snapshot.positions,
      ...(snapshot.error ? { error: snapshot.error } : {}),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
