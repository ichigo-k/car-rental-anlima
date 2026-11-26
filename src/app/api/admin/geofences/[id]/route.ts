import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { trustedOrigin } from "@/lib/request";
import { geofenceData, geofenceInput } from "@/lib/geofences";
async function manager(req: Request) {
  try {
    const current = await requireStaff("gps.geofence.manage");
    return trustedOrigin(req) ? current : null;
  } catch {
    return null;
  }
}
// Edits a geofence. A changed area starts fresh: cars are re-checked against
// it on the next position update.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const current = await manager(req);
  if (!current)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = geofenceInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const { id } = await params;
  const fence = await db.geofence
    .update({ where: { id }, data: geofenceData(parsed.data) })
    .catch(() => null);
  if (!fence) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.geofenceState.deleteMany({ where: { geofenceId: id } });
  await db.auditEvent.create({
    data: {
      actorId: current.user.id,
      action: "GEOFENCE_UPDATED",
      entityId: id,
      detail: `${fence.kind} ${fence.shape} "${fence.name}", ${fence.active ? "active" : "paused"}`,
    },
  });
  return NextResponse.json({ ok: true });
}
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const current = await manager(req);
  if (!current)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const fence = await db.geofence.delete({ where: { id } }).catch(() => null);
  if (!fence) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.auditEvent.create({
    data: {
      actorId: current.user.id,
      action: "GEOFENCE_DELETED",
      entityId: id,
      detail: `"${fence.name}" and its alerts`,
    },
  });
  return NextResponse.json({ ok: true });
}
