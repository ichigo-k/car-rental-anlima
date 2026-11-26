import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { trustedOrigin } from "@/lib/request";
// A member of the tracking staff acknowledges a geofence alert.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let current;
  try {
    current = await requireStaff("gps.view");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!trustedOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const { id } = await params;
  const done = await db.geofenceEvent.updateMany({
    where: { id, acknowledgedAt: null },
    data: { acknowledgedBy: current.user.id, acknowledgedAt: new Date() },
  });
  if (done.count)
    await db.auditEvent.create({
      data: {
        actorId: current.user.id,
        action: "GEOFENCE_ALERT_ACKNOWLEDGED",
        entityId: id,
        detail: "Geofence alert acknowledged",
      },
    });
  return NextResponse.json({ ok: true });
}
