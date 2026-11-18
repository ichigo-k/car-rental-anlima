import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_ROUTE_HOURS, vehicleRoute } from "@/lib/gps";
// Recorded route for one car: ?from=…&to=… (ISO times, at most 72 hours apart).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ vehicleId: string }> },
) {
  let current;
  try {
    current = await requireStaff("gps.view");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { vehicleId } = await params;
  const url = new URL(req.url);
  const to = new Date(url.searchParams.get("to") ?? Date.now());
  const from = new Date(
    url.searchParams.get("from") ?? to.getTime() - 24 * 3600000,
  );
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    from >= to ||
    to.getTime() - from.getTime() > MAX_ROUTE_HOURS * 3600000
  )
    return NextResponse.json(
      { error: `Choose a period of up to ${MAX_ROUTE_HOURS} hours.` },
      { status: 400 },
    );
  const car = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true, name: true, gpsImei: true },
  });
  if (!car?.gpsImei)
    return NextResponse.json(
      { error: "This car has no tracker linked." },
      { status: 404 },
    );
  let points;
  try {
    points = await vehicleRoute(car.gpsImei, from, to);
  } catch (error) {
    return NextResponse.json(
      {
        error: `Tracksolid is unavailable: ${error instanceof Error ? error.message : "request failed"}`,
      },
      { status: 502 },
    );
  }
  await db.auditEvent.create({
    data: {
      actorId: current.user.id,
      action: "GPS_ROUTE_VIEWED",
      entityId: car.id,
      detail: `${car.name}: ${from.toISOString()} to ${to.toISOString()}, ${points.length} points`,
    },
  });
  return NextResponse.json(
    { points },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
