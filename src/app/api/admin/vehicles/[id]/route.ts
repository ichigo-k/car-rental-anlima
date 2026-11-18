import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { pickupPointsInput } from "@/lib/reservation";
import {
  driverRateIssue,
  VEHICLE_CATEGORIES,
  vehicleImageInput,
  vehiclePricingPatch,
} from "@/lib/vehicle-options";
import { can } from "@/lib/permissions";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const current = await requireStaff();
    if (!can(current.user.role, "vehicle.write"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (
      req.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin
    )
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const data = z
      .object({
        dailyRate: z.number().int().positive().max(100000000),
        deposit: z.number().int().nonnegative().max(100000000),
        status: z.enum(["AVAILABLE", "MAINTENANCE", "INACTIVE"]),
        pickupPoints: pickupPointsInput.optional(),
        name: z.string().min(3).max(120).optional(),
        category: z.enum(VEHICLE_CATEGORIES).optional(),
        seats: z.number().int().min(2).max(15).optional(),
        image: vehicleImageInput.optional(),
        description: z.string().min(10).max(2000).optional(),
      })
      .merge(vehiclePricingPatch)
      .parse(await req.json());
    const issue = driverRateIssue(data);
    if (issue) return NextResponse.json({ error: issue }, { status: 400 });
    const { id } = await params;
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id = ${id} FOR UPDATE`;
      await tx.vehicle.update({ where: { id }, data });
      await tx.auditEvent.create({
        data: {
          actorId: current.user.id,
          action: "VEHICLE_UPDATED",
          entityId: id,
          detail: JSON.stringify(data),
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not update this vehicle. Check the fields and your access.",
      },
      { status: 400 },
    );
  }
}
