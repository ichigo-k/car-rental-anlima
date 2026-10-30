import { db } from "./db";
import { blockingWhere, overlaps } from "./pricing";
export function paymentKey() {
  if (!process.env.PAYSTACK_SECRET_KEY)
    throw new Error(
      "Paystack is not configured yet. Your reservation is pending; no payment has been taken.",
    );
  return process.env.PAYSTACK_SECRET_KEY;
}
export async function verifyPayment(reference: string) {
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${paymentKey()}` }, cache: "no-store" },
  );
  const result = await response.json();
  if (!response.ok || !result.status || result.data.status !== "success")
    throw new Error("Payment has not been verified yet.");
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({
      where: { reference },
      include: { booking: true },
    });
    await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id = ${payment.booking.vehicleId} FOR UPDATE`;
    const fresh = await tx.payment.findUniqueOrThrow({
      where: { reference },
      include: { booking: true },
    });
    if (fresh.status === "SUCCESS") return fresh.booking.reference;
    if (
      result.data.reference !== reference ||
      result.data.amount !== payment.amount ||
      result.data.currency !== "GHS"
    )
      throw new Error("Payment details do not match the reservation.");
    const b = fresh.booking;
    const conflict = await tx.booking.findFirst({
      where: {
        id: { not: b.id },
        vehicleId: b.vehicleId,
        ...overlaps(b.pickup, b.returnAt),
        ...blockingWhere(new Date()),
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
        status: "SUCCESS",
        reference: { not: reference },
      },
    });
    const status =
      duplicate ||
      conflict ||
      block ||
      car.status !== "AVAILABLE" ||
      (b.status === "PENDING_PAYMENT" && b.holdExpiresAt <= new Date()) ||
      !["PENDING_PAYMENT", "CONFIRMED"].includes(b.status)
        ? "PAYMENT_REVIEW"
        : "CONFIRMED";
    await tx.payment.update({
      where: { reference },
      data: { status: "SUCCESS", verifiedAt: new Date() },
    });
    await tx.booking.update({ where: { id: b.id }, data: { status } });
    await tx.auditEvent.create({
      data: {
        actorId: "PAYSTACK",
        action: "PAYMENT_VERIFIED",
        entityId: b.id,
        detail: status,
      },
    });
    return b.reference;
  });
}
