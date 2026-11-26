import { NextResponse } from "next/server";
import { z } from "zod";
import { session } from "@/lib/auth";
import { trustedOrigin } from "@/lib/request";
import { db } from "@/lib/db";
import { bookingWindowIssue, priceRental, PricingError } from "@/lib/pricing";
import { getFees } from "@/lib/fees";
import { rentalOptionsInput } from "@/lib/reservation";
import { CouponError, promotionQuote } from "@/lib/promotions";
const input = rentalOptionsInput.extend({
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
    const issue = bookingWindowIssue(pickup, end);
    if (issue) return NextResponse.json({ error: issue }, { status: 400 });
    const base = priceRental(pickup, end, car, v, await getFees(db));
    const offer = await promotionQuote(
      db,
      car.id,
      base.rentalAmount - base.durationDiscount,
      v.couponCode,
      new Date(),
    );
    const items = offer.discountAmount
      ? [
          ...base.items.slice(0, -1),
          {
            kind: "PROMOTION",
            label: offer.promotionName ?? "Offer",
            amount: -offer.discountAmount,
          },
          base.items.at(-1)!,
        ]
      : base.items;
    return NextResponse.json(
      { ...base, ...offer, items, total: base.total - offer.discountAmount },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof CouponError || e instanceof PricingError
            ? e.message
            : "Could not check the quote. Review your dates and try again.",
      },
      { status: 400 },
    );
  }
}
