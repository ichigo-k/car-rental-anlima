import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalise } from "@/lib/gps";
import { trustedOrigin } from "@/lib/request";
import {
  deviceLocations,
  relayOutcome,
  sendRelay,
  tracksolidConfig,
} from "@/lib/tracksolid";
// Cutting the engine of a moving car is dangerous, so it is only sent while
// the tracker reports the car stopped or nearly so.
const MAX_CUT_SPEED_KMH = 5;
const input = z.object({
  action: z.enum(["cut", "restore"]),
  reason: z
    .string()
    .trim()
    .min(5, "Give a reason of at least 5 characters.")
    .max(300),
});
async function carWithTracker(vehicleId: string) {
  return db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true, name: true, gpsImei: true },
  });
}
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

// Sends "cut fuel/power" or "restore" to a car's tracker (Admin and Manager).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ vehicleId: string }> },
) {
  let current;
  try {
    current = await requireStaff("gps.immobilise");
  } catch {
    return fail("Forbidden", 403);
  }
  if (!trustedOrigin(req)) return fail("Forbidden", 403);
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message, 400);
  const { action, reason } = parsed.data;
  const config = tracksolidConfig();
  if (!config) return fail("Tracksolid Pro is not connected.", 409);
  const { vehicleId } = await params;
  const car = await carWithTracker(vehicleId);
  if (!car?.gpsImei) return fail("This car has no tracker linked.", 404);

  let speed: number | null = null;
  try {
    const [location] = await deviceLocations(config, [car.gpsImei]);
    const position = normalise(car.id, location);
    speed = position.speedKmh;
    if (position.freshness === "OFFLINE")
      return fail(
        "The tracker is offline, so the command cannot reach it. Try again when it reports in.",
        409,
      );
    if (action === "cut" && speed !== null && speed > MAX_CUT_SPEED_KMH)
      return fail(
        `The car is moving at ${Math.round(speed)} km/h. The engine can only be cut once it has stopped.`,
        409,
      );
    await sendRelay(config, car.gpsImei, action);
  } catch (error) {
    return fail(
      `Tracksolid did not accept the command: ${error instanceof Error ? error.message : "request failed"}`,
      502,
    );
  }
  const rental = await db.booking.findFirst({
    where: { vehicleId: car.id, status: "CHECKED_OUT" },
    select: { reference: true },
  });
  await db.auditEvent.create({
    data: {
      actorId: current.user.id,
      action: action === "cut" ? "IMMOBILISE_SENT" : "IMMOBILISE_RESTORE_SENT",
      entityId: car.id,
      detail: `${car.name}: ${reason}${rental ? ` (on rental ${rental.reference})` : ""}${speed !== null ? `; ${Math.round(speed)} km/h` : ""}`,
    },
  });
  return NextResponse.json({ ok: true });
}

// What the tracker has reported for the latest cut-off or restore command.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ vehicleId: string }> },
) {
  try {
    await requireStaff("gps.immobilise");
  } catch {
    return fail("Forbidden", 403);
  }
  const config = tracksolidConfig();
  if (!config) return fail("Tracksolid Pro is not connected.", 409);
  const car = await carWithTracker((await params).vehicleId);
  if (!car?.gpsImei) return fail("This car has no tracker linked.", 404);
  try {
    return NextResponse.json(
      { outcome: await relayOutcome(config, car.gpsImei) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return fail(
      `Tracksolid is unavailable: ${error instanceof Error ? error.message : "request failed"}`,
      502,
    );
  }
}
