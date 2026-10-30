import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { session } from "@/lib/auth";
import { quote, blockingWhere, overlaps } from "@/lib/pricing";
import {
  reservationInput,
  licenceValidThrough,
  RESERVATION_HOLD_MINUTES,
} from "@/lib/reservation";
import { encryptIdentity } from "@/lib/identity";
import { promotionQuote, CouponError } from "@/lib/promotions";
export async function POST(req: Request) {
  if (
    req.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin
  )
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  let current;
  try {
    current = await session();
  } catch {
    return NextResponse.json(
      { error: "Your account could not be checked. Please try again." },
      { status: 503 },
    );
  }
  if (!current)
    return NextResponse.json(
      { error: "Sign in to reserve your vehicle." },
      { status: 401 },
    );
  const parsed = reservationInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const v = parsed.data,
    pickup = new Date(v.pickup),
    returnAt = new Date(v.returnAt);
  if (v.customerEmail.toLowerCase() !== current.user.email.toLowerCase())
    return NextResponse.json(
      { error: "Use the email address on your signed-in account." },
      { status: 400 },
    );
  if (pickup <= new Date() || !licenceValidThrough(v.licenceExpiry, returnAt))
    return NextResponse.json(
      {
        error:
          "Pickup must be in the future and your licence must remain valid for the rental.",
      },
      { status: 400 },
    );
  try {
    const booking = await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id = ${v.vehicleId} FOR UPDATE`;
        const car = await tx.vehicle.findUniqueOrThrow({
          where: { id: v.vehicleId },
        });
        if (!car.pickupPoints.includes(v.location))
          throw new Error(
            "Choose one of the configured pickup points for this vehicle.",
          );
        if (
          car.status !== "AVAILABLE" ||
          (await tx.booking.findFirst({
            where: {
              vehicleId: car.id,
              ...overlaps(pickup, returnAt),
              ...blockingWhere(new Date()),
            },
          })) ||
          (await tx.vehicleBlock.findFirst({
            where: {
              vehicleId: car.id,
              start: { lt: returnAt },
              end: { gt: pickup },
            },
          }))
        )
          throw new Error(
            "This vehicle is unavailable for those dates. Choose another vehicle or interval.",
          );
        const pricing = quote(pickup, returnAt, car.dailyRate, car.deposit);
        const offer = await promotionQuote(
          tx,
          car.id,
          pricing.rentalAmount,
          v.couponCode,
          new Date(),
          true,
        );
        const total = pricing.total - offer.discountAmount;
        if (v.expectedTotal !== undefined && v.expectedTotal !== total)
          throw new CouponError(
            "The price or offer changed. Review the updated quote and try again.",
          );
        const created = await tx.booking.create({
          data: {
            reference: `AN-${randomBytes(6).toString("hex").toUpperCase()}`,
            userId: current.user.id,
            vehicleId: car.id,
            pickup,
            returnAt,
            location: v.location,
            phone: v.phone,
            customerName: v.customerName,
            customerEmail: current.user.email,
            ghanaCardEncrypted: encryptIdentity(v.ghanaCardNumber),
            ghanaCardLast4: v.ghanaCardNumber.replaceAll("-", "").slice(-4),
            licenceNumber: v.licenceNumber,
            licenceExpiry: new Date(v.licenceExpiry),
            ...pricing,
            ...offer,
            total,
            termsVersion: "2026-10-draft",
            termsAcceptedAt: new Date(),
            holdExpiresAt: new Date(
              Date.now() + RESERVATION_HOLD_MINUTES * 60000,
            ),
          },
        });
        await tx.auditEvent.create({
          data: {
            actorId: current.user.id,
            action: "BOOKING_CREATED",
            entityId: created.id,
            detail: "15 minute payment hold; draft terms accepted",
          },
        });
        return created;
      },
      { maxWait: 15000, timeout: 30000 },
    );
    return NextResponse.json({
      reference: booking.reference,
      holdExpiresAt: booking.holdExpiresAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof CouponError ||
          (error instanceof Error &&
            /^(This vehicle is unavailable|Choose one of|Choose a return time|For rentals longer|Identity storage)/.test(
              error.message,
            ))
            ? error.message
            : "Could not reserve this vehicle. Please try again.",
      },
      { status: 409 },
    );
  }
}
