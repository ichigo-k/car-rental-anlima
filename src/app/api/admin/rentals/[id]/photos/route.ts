import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { allowed } from "@/lib/booking-lifecycle";
import { trustedOrigin } from "@/lib/request";
import {
  MAX_INSPECTION_PHOTOS,
  PhotoError,
  deletePhotoFile,
  savePhoto,
} from "@/lib/photos";
// Uploads one handover (CHECKOUT) or return (RETURN) photo as multipart form
// data: file, kind and optionally takenAt (ISO time from the device). The
// photo joins its inspection when the inspection is saved.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let current;
  try {
    current = await requireStaff();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!allowed("handover", current.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!trustedOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const { id } = await params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind");
  if (!(file instanceof File) || (kind !== "CHECKOUT" && kind !== "RETURN"))
    return NextResponse.json(
      { error: "Choose a photo to upload." },
      { status: 400 },
    );
  const takenAt = new Date(String(form?.get("takenAt") ?? ""));
  const booking = await db.booking.findUnique({
    where: { id },
    select: { status: true },
  });
  if (
    !booking ||
    booking.status !== (kind === "CHECKOUT" ? "CONFIRMED" : "CHECKED_OUT")
  )
    return NextResponse.json(
      { error: "This booking is not ready for that inspection." },
      { status: 409 },
    );
  const pending = await db.inspectionPhoto.count({
    where: { bookingId: id, kind, inspectionId: null },
  });
  if (pending >= MAX_INSPECTION_PHOTOS)
    return NextResponse.json(
      { error: `Up to ${MAX_INSPECTION_PHOTOS} photos per inspection.` },
      { status: 400 },
    );
  let saved;
  try {
    saved = await savePhoto(new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof PhotoError ? e.message : "The photo could not be saved.",
      },
      { status: 400 },
    );
  }
  try {
    const photo = await db.inspectionPhoto.create({
      data: {
        ...saved,
        bookingId: id,
        kind,
        takenAt:
          Number.isFinite(takenAt.getTime()) && takenAt <= new Date()
            ? takenAt
            : null,
        uploadedBy: current.user.id,
      },
    });
    return NextResponse.json({ id: photo.id });
  } catch {
    await deletePhotoFile(saved.storageKey);
    return NextResponse.json(
      { error: "The photo could not be saved." },
      { status: 500 },
    );
  }
}
