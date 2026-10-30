import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
const schema = z.object({
  kind: z.enum(["CHECKOUT", "RETURN"]),
  mileage: z.number().int().nonnegative(),
  fuel: z.enum(["Full", "Three quarters", "Half", "Quarter", "Empty"]),
  condition: z.string().min(5).max(3000),
  acknowledgement: z.string().min(3).max(200),
});
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const current = await requireStaff();
    if (!["ADMIN", "MANAGER", "AGENT"].includes(current.user.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (
      req.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin
    )
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const data = schema.parse(await req.json());
    const { id } = await params;
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${id} FOR UPDATE`;
      const b = await tx.booking.findUniqueOrThrow({
        where: { id },
        include: { inspections: true },
      });
      if (b.status !== (data.kind === "CHECKOUT" ? "CONFIRMED" : "ACTIVE"))
        throw new Error("This reservation is not ready for that operation.");
      if (
        data.kind === "RETURN" &&
        data.mileage <
          (b.inspections.find((i) => i.kind === "CHECKOUT")?.mileage ?? 0)
      )
        throw new Error("Return mileage cannot be lower than pickup mileage.");
      await tx.inspection.create({
        data: { ...data, bookingId: id, recordedBy: current.user.id },
      });
      await tx.booking.update({
        where: { id },
        data: { status: data.kind === "CHECKOUT" ? "ACTIVE" : "COMPLETED" },
      });
      await tx.auditEvent.create({
        data: {
          actorId: current.user.id,
          action: data.kind,
          entityId: id,
          detail: "Inspection and acknowledgement recorded",
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
