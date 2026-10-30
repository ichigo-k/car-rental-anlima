import { randomBytes } from "node:crypto";
import { db } from "./db";
import { providerKey, paymentOptions } from "./payment-config";
import {
  hostedCheckoutUrl,
  pesewasToGhs,
  type PaymentProvider,
  providerName,
} from "./payment-options";
import { blockingWhere, overlaps } from "./pricing";
export class CheckoutError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function startCheckout(
  reference: string,
  userId: string,
  provider: PaymentProvider,
) {
  if (!paymentOptions().find((p) => p.id === provider)?.enabled)
    throw new CheckoutError(
      `${providerName(provider)} is not configured yet. No payment has been taken.`,
      503,
    );
  const key = providerKey(provider);
  const payment = await db.$transaction(async (tx) => {
    const initial = await tx.booking.findFirst({
      where: { reference, userId },
    });
    if (!initial) throw new CheckoutError("Reservation not found.", 404);
    await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id = ${initial.vehicleId} FOR UPDATE`;
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: initial.id },
      include: { user: true },
    });
    const now = new Date();
    if (booking.status !== "PENDING_PAYMENT" || booking.holdExpiresAt <= now)
      throw new CheckoutError(
        "This reservation is no longer awaiting payment. Check your bookings before trying again.",
        409,
      );
    const car = await tx.vehicle.findUniqueOrThrow({
      where: { id: booking.vehicleId },
    });
    const conflict = await tx.booking.findFirst({
      where: {
        id: { not: booking.id },
        vehicleId: booking.vehicleId,
        ...overlaps(booking.pickup, booking.returnAt),
        ...blockingWhere(now),
      },
    });
    const block = await tx.vehicleBlock.findFirst({
      where: {
        vehicleId: booking.vehicleId,
        start: { lt: booking.returnAt },
        end: { gt: booking.pickup },
      },
    });
    if (car.status !== "AVAILABLE" || conflict || block)
      throw new CheckoutError(
        "This car is no longer available for those dates. Please contact the rental team.",
        409,
      );
    const attempt = await tx.payment.create({
      data: {
        reference: `${booking.reference}-${randomBytes(8).toString("hex")}`,
        bookingId: booking.id,
        amount: booking.total,
        provider,
      },
    });
    return { ...attempt, booking };
  });
  try {
    const base = process.env.BETTER_AUTH_URL!;
    const email = payment.booking.customerEmail ?? payment.booking.user.email;
    const body =
      provider === "PAYSTACK"
        ? {
            email,
            amount: payment.amount,
            currency: "GHS",
            reference: payment.reference,
            channels: ["card", "mobile_money"],
            callback_url: `${base}/api/payments/callback`,
            metadata: { booking_reference: payment.booking.reference },
          }
        : {
            tx_ref: payment.reference,
            amount: pesewasToGhs(payment.amount),
            currency: "GHS",
            redirect_url: `${base}/api/payments/flutterwave/callback`,
            payment_options: "card,mobilemoneyghana",
            link_expiration: payment.booking.holdExpiresAt.toISOString(),
            customer: {
              email,
              name: payment.booking.customerName ?? payment.booking.user.name,
              phonenumber: payment.booking.phone,
            },
            customizations: {
              title: "ANLIMA Car Rental",
              description: `Reservation ${payment.booking.reference}`,
            },
            meta: { booking_reference: payment.booking.reference },
          };
    const response = await fetch(
      provider === "PAYSTACK"
        ? "https://api.paystack.co/transaction/initialize"
        : "https://api.flutterwave.com/v3/payments",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      },
    );
    const result = await response.json();
    if (
      !response.ok ||
      (provider === "PAYSTACK" ? !result.status : result.status !== "success")
    )
      throw new Error("Checkout unavailable");
    const url = hostedCheckoutUrl(
      provider === "PAYSTACK"
        ? result.data?.authorization_url
        : result.data?.link,
      provider,
    );
    if (payment.booking.holdExpiresAt <= new Date())
      throw new CheckoutError(
        "The payment window ended. Please check availability and reserve again.",
        409,
      );
    return { url, provider };
  } catch (error) {
    await db.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "FAILED" },
    });
    if (error instanceof CheckoutError) throw error;
    throw new CheckoutError(
      `${providerName(provider)} checkout could not be started. Please try again or choose the other payment option.`,
      502,
    );
  }
}
