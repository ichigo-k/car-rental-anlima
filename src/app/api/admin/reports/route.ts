import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
const cell = (v: string | number) =>
  `"${String(v)
    .replace(/^[=+@-]/, "'")
    .replaceAll('"', '""')}"`;
export async function GET() {
  try {
    const current = await requireStaff();
    if (!["ADMIN", "MANAGER", "FINANCE"].includes(current.user.role))
      throw new Error();
    const bookings = await db.booking.findMany({
      include: { vehicle: true },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    await db.auditEvent.create({
      data: {
        actorId: current.user.id,
        action: "REPORT_EXPORTED",
        entityId: "bookings",
        detail: `${bookings.length} rows (maximum 10000)`,
      },
    });
    const csv = [
      "Reference,Vehicle,Pickup,Return,Status,Rental GHS,Deposit GHS,Total GHS",
      ...bookings.map((b) =>
        [
          b.reference,
          b.vehicle.name,
          b.pickup.toISOString(),
          b.returnAt.toISOString(),
          b.status,
          b.rentalAmount / 100,
          b.deposit / 100,
          b.total / 100,
        ]
          .map(cell)
          .join(","),
      ),
    ].join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=anlima-reservations.csv",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
