import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { allowed } from "@/lib/booking-lifecycle";
import { trustedOrigin } from "@/lib/request";
import { deletePhotoFile, readPhoto } from "@/lib/photos";
// Inspection photos are shown only to staff who can see bookings.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaff("booking.read");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const photo = await db.inspectionPhoto.findUnique({ where: { id } });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const bytes = await readPhoto(photo.storageKey);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": photo.contentType,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
// Removes a photo that has not yet joined a saved inspection.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let current;
  try {
    current = await requireStaff();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!allowed("handover", current.user.role) || !trustedOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const photo = await db.inspectionPhoto.findUnique({ where: { id } });
  if (!photo || photo.inspectionId)
    return NextResponse.json(
      { error: "Photos of a saved inspection are kept." },
      { status: 409 },
    );
  await db.inspectionPhoto.delete({ where: { id } });
  await deletePhotoFile(photo.storageKey);
  return NextResponse.json({ ok: true });
}
