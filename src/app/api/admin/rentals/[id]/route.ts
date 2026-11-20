import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { allowed } from "@/lib/booking-lifecycle";
import { getFees, returnCharges, FUEL_LEVELS } from "@/lib/fees";
import { MAX_INSPECTION_PHOTOS, MIN_INSPECTION_PHOTOS } from "@/lib/photos";
const schema = z.object({
  kind: z.enum(["CHECKOUT", "RETURN"]),
  mileage: z.number().int().nonnegative(),
  fuel: z.enum(FUEL_LEVELS),
  condition: z.string().min(5).max(3000),
  acknowledgement: z.string().min(3).max(200),
  photoIds: z
    .array(z.string().min(1).max(64))
    .min(MIN_INSPECTION_PHOTOS, "Add at least one photo of the car.")
    .max(MAX_INSPECTION_PHOTOS),
});
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const current = await requireStaff();
    if (!allowed("handover", current.user.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    const { photoIds, ...data } = parsed.data;
    const { id } = await params;
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${id} FOR UPDATE`;
      const b = await tx.booking.findUniqueOrThrow({
        where: { id },
        include: { inspections: true },
      });
      if (b.status !== (data.kind === "CHECKOUT" ? "CONFIRMED" : "CHECKED_OUT"))
        throw new Error("This reservation is not ready for that operation.");
      if (
        data.kind === "RETURN" &&
        data.mileage <
          (b.inspections.find((i) => i.kind === "CHECKOUT")?.mileage ?? 0)
      )
        throw new Error("Return mileage cannot be lower than pickup mileage.");
      const inspection = await tx.inspection.create({
        data: { ...data, bookingId: id, recordedBy: current.user.id },
      });
      const attached = await tx.inspectionPhoto.updateMany({
        where: {
          id: { in: [...new Set(photoIds)] },
          bookingId: id,
          kind: data.kind,
          inspectionId: null,
        },
        data: { inspectionId: inspection.id },
      });
      if (attached.count !== new Set(photoIds).size)
        throw new Error("Some photos could not be found. Upload them again.");
      const now = new Date();
      await tx.booking.update({
        where: { id },
        data:
          data.kind === "CHECKOUT"
            ? { status: "CHECKED_OUT" }
            : { status: "RETURNED", returnedAt: now },
      });
      if (data.kind === "RETURN") {
        const proposals = returnCharges(
          await getFees(tx),
          b,
          b.inspections.find((i) => i.kind === "CHECKOUT"),
          { ...data, at: now },
        );
        if (proposals.length)
          await tx.bookingCharge.createMany({
            data: proposals.map((c) => ({
              ...c,
              bookingId: id,
              proposedBy: "SYSTEM",
            })),
          });
      }
      await tx.auditEvent.create({
        data: {
          actorId: current.user.id,
          action: data.kind,
          entityId: id,
          detail: `Inspection and acknowledgement recorded with ${attached.count} photo${attached.count === 1 ? "" : "s"}`,
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Operation failed" },
      { status: 400 },
    );
  }
}
