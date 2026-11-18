import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditGpsView, fleetPositions } from "@/lib/gps";
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
