import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { trustedOrigin } from "@/lib/request";
import { geofenceData, geofenceInput } from "@/lib/geofences";
// Creates a geofence drawn on the tracking map.
export async function POST(req: Request) {
  let current;
  try {
    current = await requireStaff("gps.geofence.manage");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!trustedOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const parsed = geofenceInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const fence = await db.geofence.create({
    data: { ...geofenceData(parsed.data), createdBy: current.user.id },
  });
  await db.auditEvent.create({
    data: {
      actorId: current.user.id,
      action: "GEOFENCE_CREATED",
      entityId: fence.id,
      detail: `${fence.kind} ${fence.shape} "${fence.name}", ${fence.appliesWhen.toLowerCase()}, ${fence.vehicleIds.length || "all"} car(s)`,
    },
  });
  return NextResponse.json({ id: fence.id });
}
