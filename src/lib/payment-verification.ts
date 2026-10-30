import { db } from "./db";
import { blockingWhere, overlaps } from "./pricing";
import type { PaymentProvider } from "./payment-options";
export type VerifiedCharge = {
  reference: string;
  provider: PaymentProvider;
  amount: number;
  currency: string;
};
export function assertChargeMatches(
  charge: VerifiedCharge,
  payment: { reference: string; provider: string; amount: number },
) {
  if (
    charge.reference !== payment.reference ||
    charge.provider !== payment.provider ||
    charge.currency !== "GHS" ||
    !Number.isSafeInteger(charge.amount) ||
    charge.amount !== payment.amount
  )
    throw new Error("Payment details do not match the reservation.");
}
export async function recordVerifiedPayment(charge: VerifiedCharge) {
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({
      where: { reference: charge.reference },
      include: { booking: true },
    });
    assertChargeMatches(charge, payment);
    await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id = ${payment.booking.vehicleId} FOR UPDATE`;
    const fresh = await tx.payment.findUniqueOrThrow({
      where: { reference: charge.reference },
      include: { booking: true },
    });
    if (["SUCCESS", "SUCCESS_REVIEW"].includes(fresh.status))
      return {
        reference: fresh.booking.reference,
        status: fresh.booking.status,
        review:
          fresh.status === "SUCCESS_REVIEW" ||
          fresh.booking.status === "PAYMENT_REVIEW",
      };
    const b = fresh.booking;
    const now = new Date();
    const conflict = await tx.booking.findFirst({
      where: {
        id: { not: b.id },
        vehicleId: b.vehicleId,
        ...overlaps(b.pickup, b.returnAt),
        ...blockingWhere(now),
      },
    });
    const car = await tx.vehicle.findUniqueOrThrow({
      where: { id: b.vehicleId },
    });
    const block = await tx.vehicleBlock.findFirst({
      where: {
        vehicleId: b.vehicleId,
        start: { lt: b.returnAt },
        end: { gt: b.pickup },
      },
    });
    const duplicate = await tx.payment.findFirst({
      where: {
        bookingId: b.id,
        status: { in: ["SUCCESS", "SUCCESS_REVIEW"] },
        reference: { not: charge.reference },
      },
    });
    const needsReview = !!(
      duplicate ||
      conflict ||
      block ||
      car.status !== "AVAILABLE" ||
      b.total !== charge.amount ||
      (b.status === "PENDING_PAYMENT" && b.holdExpiresAt <= now) ||
      !["PENDING_PAYMENT", "CONFIRMED"].includes(b.status)
    );
    // A duplicate charge must never release a confirmed or on-road rental.
    const keepOperationalStatus = ["CONFIRMED", "ACTIVE", "COMPLETED"].includes(
      b.status,
    );
    const status = needsReview
      ? keepOperationalStatus
        ? b.status
        : "PAYMENT_REVIEW"
      : "CONFIRMED";
    await tx.payment.update({
      where: { id: fresh.id },
      data: {
        status:
          needsReview && keepOperationalStatus ? "SUCCESS_REVIEW" : "SUCCESS",
        verifiedAt: now,
      },
    });
    await tx.booking.update({ where: { id: b.id }, data: { status } });
    await tx.auditEvent.create({
      data: {
        actorId: charge.provider,
        action: "PAYMENT_VERIFIED",
        entityId: b.id,
        detail: needsReview
          ? `${status}; payment requires staff review; ${charge.reference}`
          : status,
      },
    });
    return { reference: b.reference, status, review: needsReview };
  });
}
