import { NextResponse } from "next/server";
import { z } from "zod";
import { session } from "@/lib/auth";
import { trustedOrigin } from "@/lib/request";
import { db } from "@/lib/db";
import { quote } from "@/lib/pricing";
import { CouponError, promotionQuote } from "@/lib/promotions";
const input = z.object({
  vehicleId: z.string().min(1).max(128),
  pickup: z.iso.datetime(),
  returnAt: z.iso.datetime(),
  couponCode: z
    .string()
    .trim()
    .toUpperCase()
    .max(40)
    .regex(/^[A-Z0-9-]*$/)
    .optional(),
});
export async function POST(req: Request) {
  try {
    if (!trustedOrigin(req))
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    if (!(await session()))
      return NextResponse.json(
        { error: "Sign in to check offers." },
        { status: 401 },
      );
    const v = input.parse(await req.json());
    const car = await db.vehicle.findUniqueOrThrow({
      where: { id: v.vehicleId },
    });
    if (car.status !== "AVAILABLE")
      return NextResponse.json(
        { error: "This car is not available." },
        { status: 409 },
      );
    const pickup = new Date(v.pickup),
      end = new Date(v.returnAt);
    if (pickup <= new Date())
      return NextResponse.json(
        { error: "Choose a future pickup time." },
        { status: 400 },
      );
    const base = quote(pickup, end, car.dailyRate, car.deposit);
    const offer = await promotionQuote(
      db,
      car.id,
      base.rentalAmount,
      v.couponCode,
      new Date(),
    );
    return NextResponse.json(
      { ...base, ...offer, total: base.total - offer.discountAmount },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof CouponError
            ? e.message
            : "Could not check the quote. Review your dates and try again.",
      },
      { status: 400 },
    );
  }
}
