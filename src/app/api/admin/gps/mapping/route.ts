import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
const schema = z.object({
  vehicleId: z.string().min(1).max(128),
  imei: z
    .string()
    .regex(/^\d{8,20}$/, "Choose a tracker from the list.")
    .nullable(),
});
export async function POST(req: Request) {
  let current;
  try {
    current = await requireStaff("vehicle.write");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (
    req.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin
  )
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const { vehicleId, imei } = parsed.data;
  try {
    await db.$transaction(async (tx) => {
      const car = await tx.vehicle.update({
        where: { id: vehicleId },
        data: { gpsImei: imei },
      });
      await tx.auditEvent.create({
        data: {
          actorId: current.user.id,
          action: "GPS_TRACKER_LINKED",
          entityId: car.id,
          detail: imei ? `Tracker …${imei.slice(-4)}` : "Tracker removed",
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const taken =
      e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
    return NextResponse.json(
      {
        error: taken
          ? "That tracker is already linked to another car."
          : "Could not link the tracker.",
      },
      { status: 409 },
    );
  }
}
