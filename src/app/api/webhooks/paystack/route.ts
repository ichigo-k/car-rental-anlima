import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { paymentKey, verifyPayment } from "@/lib/paystack";
export async function POST(req: Request) {
  if (!process.env.PAYSTACK_SECRET_KEY)
    return NextResponse.json(
      { error: "Provider unavailable" },
      { status: 503 },
    );
  const body = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";
  const expected = createHmac("sha512", paymentKey())
    .update(body)
    .digest("hex");
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  try {
    const event = JSON.parse(body);
    if (event.event === "charge.success")
      await verifyPayment(event.data.reference);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Verification failed; retry required" },
      { status: 503 },
    );
  }
}
