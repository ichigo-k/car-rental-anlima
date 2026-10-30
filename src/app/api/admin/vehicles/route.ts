import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { trustedOrigin, vehicleInput } from "@/lib/request";
export async function POST(req: Request) {
  try {
    const current = await requireStaff();
    if (
      !trustedOrigin(req) ||
      !["ADMIN", "MANAGER", "FLEET"].includes(current.user.role)
    )
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = vehicleInput.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    const vehicle = await db.$transaction(async (tx) => {
      const car = await tx.vehicle.create({ data: parsed.data });
      await tx.auditEvent.create({
        data: {
          actorId: current.user.id,
          action: "VEHICLE_CREATED",
          entityId: car.id,
          detail: car.name,
        },
      });
      return car;
    });
    return NextResponse.json({ id: vehicle.id });
  } catch {
    return NextResponse.json(
      {
        error:
          "Vehicle could not be saved. Check the unique URL slug and your access.",
      },
      { status: 400 },
    );
  }
}
