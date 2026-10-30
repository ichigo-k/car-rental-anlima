import { NextResponse } from "next/server";
import { z } from "zod";
import { session } from "@/lib/auth";
import { trustedOrigin } from "@/lib/request";
import { checkBookingPayment } from "@/lib/payment-status";
import { CheckoutError } from "@/lib/payment-checkout";
export async function POST(req: Request) {
  if (!trustedOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const current = await session();
  if (!current)
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = z
    .object({ reference: z.string().min(1).max(150) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Choose a valid reservation." },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      await checkBookingPayment(parsed.data.reference, current.user.id),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof CheckoutError
            ? error.message
            : "Payment status could not be checked. Please try again.",
      },
      { status: error instanceof CheckoutError ? error.status : 503 },
    );
  }
}
