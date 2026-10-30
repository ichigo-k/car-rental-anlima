import { db } from "./db";
import { verifyPayment } from "./paystack";
import { verifyFlutterwave } from "./flutterwave";
import { CheckoutError } from "./payment-checkout";
export async function checkBookingPayment(reference: string, userId: string) {
  const booking = await db.booking.findFirst({ where: { reference, userId } });
  if (!booking) throw new CheckoutError("Reservation not found.", 404);
  if (booking.status !== "PENDING_PAYMENT")
    return { reference, status: booking.status };
  const attempts = await db.payment.findMany({
    where: { bookingId: booking.id, status: { in: ["PENDING", "FAILED"] } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  await Promise.allSettled(
    attempts.map((p) =>
      p.provider === "PAYSTACK"
        ? verifyPayment(p.reference)
        : p.provider === "FLUTTERWAVE"
          ? verifyFlutterwave(p.reference)
          : Promise.resolve(),
    ),
  );
  const fresh = await db.booking.findUniqueOrThrow({
    where: { id: booking.id },
  });
  return { reference, status: fresh.status };
}
export function paymentReturnUrl(
  payment: "verified" | "pending" | "review" | "cancelled",
  reference?: string,
) {
  const url = new URL("/bookings", process.env.BETTER_AUTH_URL);
  url.searchParams.set("payment", payment);
  if (reference) url.searchParams.set("reference", reference);
  return url;
}
