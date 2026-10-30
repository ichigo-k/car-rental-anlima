import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { session } from "@/lib/auth";
import { db } from "@/lib/db";
import { paymentKey } from "@/lib/paystack";
export async function POST(req: Request) {
  if (
    req.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin
  )
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const current = await session();
  if (!current)
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { reference } = await req.json();
  try {
    const key = paymentKey();
    const booking = await db.booking.findFirstOrThrow({
      where: {
        reference,
        userId: current.user.id,
        status: "PENDING_PAYMENT",
        holdExpiresAt: { gt: new Date() },
      },
    });
    const paymentRef = `${booking.reference}-${randomBytes(4).toString("hex")}`;
    await db.payment.create({
      data: {
        reference: paymentRef,
        bookingId: booking.id,
        amount: booking.total,
      },
    });
    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: current.user.email,
          amount: booking.total,
          currency: "GHS",
          reference: paymentRef,
          callback_url: `${process.env.BETTER_AUTH_URL}/api/payments/callback`,
        }),
      },
    );
    const result = await response.json();
    if (!response.ok || !result.status)
      throw new Error(
        "Paystack checkout could not be started. Please try again.",
      );
    return NextResponse.json({ url: result.data.authorization_url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout unavailable." },
      { status: 400 },
    );
  }
}
