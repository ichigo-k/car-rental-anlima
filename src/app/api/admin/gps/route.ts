import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { gpsProvider } from "@/lib/gps";
export async function GET() {
  try {
    const current = await requireStaff();
    if (!["ADMIN", "MANAGER", "FLEET"].includes(current.user.role))
      throw new Error();
    const cars = await db.vehicle.findMany({ select: { id: true } });
    return NextResponse.json({
      mock: true,
      positions: await gpsProvider.positions(cars.map((c) => c.id)),
    });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
