import { NextResponse } from "next/server";
import { verifyPayment } from "@/lib/paystack";
import { validPaystackSignature } from "@/lib/payment-webhooks";
import { db } from "@/lib/db";
export async function POST(req: Request) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key)
    return NextResponse.json(
      { error: "Provider unavailable" },
      { status: 503 },
    );
  const body = await req.text();
  if (Buffer.byteLength(body) > 1000000)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  if (
    !validPaystackSignature(
      body,
      req.headers.get("x-paystack-signature") ?? "",
      key,
    )
  )
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  try {
    if (event.event === "charge.success") {
      const reference = event.data?.reference;
      if (typeof reference !== "string")
        return NextResponse.json(
          { error: "Invalid reference" },
          { status: 400 },
        );
      const payment = await db.payment.findUnique({ where: { reference } });
      if (payment?.provider === "PAYSTACK") await verifyPayment(reference);
    }
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Verification failed; retry required" },
      { status: 503 },
    );
  }
}
