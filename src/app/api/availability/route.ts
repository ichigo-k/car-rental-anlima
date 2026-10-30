import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { quote, blockingWhere, overlaps } from "@/lib/pricing";
export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    const pickup = new Date(url.searchParams.get("pickup") ?? ""),
      returnAt = new Date(url.searchParams.get("returnAt") ?? "");
    quote(pickup, returnAt, 1, 0);
    if (pickup <= new Date()) throw new Error("Pickup must be in the future.");
    const vehicles = await db.vehicle.findMany({
      where: {
        status: "AVAILABLE",
        bookings: {
          none: { ...overlaps(pickup, returnAt), ...blockingWhere(new Date()) },
        },
        blocks: { none: { start: { lt: returnAt }, end: { gt: pickup } } },
      },
      select: { id: true, slug: true },
    });
    return NextResponse.json({ vehicles });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Search unavailable" },
      { status: 400 },
    );
  }
}
