import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { trustedOrigin } from "@/lib/request";
import { blockingWhere, overlaps } from "@/lib/pricing";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const current = await requireStaff();
    if (
      !trustedOrigin(req) ||
      !["ADMIN", "MANAGER", "FLEET"].includes(current.user.role)
    )
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const input = z
      .object({
        start: z.iso.datetime(),
        end: z.iso.datetime(),
        reason: z.string().min(5).max(500),
      })
      .parse(await req.json());
    const start = new Date(input.start),
      end = new Date(input.end);
    if (end <= start) throw new Error("End must be after start.");
    const { id } = await params;
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id = ${id} FOR UPDATE`;
      if (
        await tx.booking.findFirst({
          where: {
            vehicleId: id,
            ...overlaps(start, end),
            ...blockingWhere(new Date()),
          },
        })
      )
        throw new Error(
          "This block overlaps a reservation. Resolve the reservation first.",
        );
      const block = await tx.vehicleBlock.create({
        data: { vehicleId: id, start, end, reason: input.reason },
      });
      await tx.auditEvent.create({
        data: {
          actorId: current.user.id,
          action: "VEHICLE_BLOCK_CREATED",
          entityId: block.id,
          detail: input.reason,
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create block" },
      { status: 400 },
    );
  }
}
