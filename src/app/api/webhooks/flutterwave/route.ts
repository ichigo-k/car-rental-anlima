import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyFlutterwave } from "@/lib/flutterwave";
import { sameSecret } from "@/lib/payment-webhooks";
export async function POST(req: Request) {
  const secret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
  if (!secret || !process.env.FLUTTERWAVE_SECRET_KEY)
    return NextResponse.json(
      { error: "Provider unavailable" },
      { status: 503 },
    );
  if (!sameSecret(req.headers.get("verif-hash") ?? "", secret))
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  const body = await req.text();
  if (Buffer.byteLength(body) > 1000000)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  try {
    if (
      event.event === "charge.completed" &&
      event.data?.status === "successful"
    ) {
      const reference = event.data.tx_ref;
      if (typeof reference !== "string")
        return NextResponse.json(
          { error: "Invalid reference" },
          { status: 400 },
        );
      const payment = await db.payment.findUnique({ where: { reference } });
      if (payment?.provider === "FLUTTERWAVE")
        await verifyFlutterwave(reference, String(event.data.id));
    }
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Verification failed; retry required" },
      { status: 503 },
    );
  }
}
