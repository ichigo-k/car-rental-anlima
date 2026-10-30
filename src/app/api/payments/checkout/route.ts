import { NextResponse } from "next/server";
import { z } from "zod";
import { session } from "@/lib/auth";
import { trustedOrigin } from "@/lib/request";
import { PAYMENT_PROVIDERS } from "@/lib/payment-options";
import { startCheckout, CheckoutError } from "@/lib/payment-checkout";
export async function POST(req: Request) {
  if (!trustedOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const current = await session();
  if (!current)
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = z
    .object({
      reference: z.string().min(1).max(150),
      provider: z.enum(PAYMENT_PROVIDERS).default("PAYSTACK"),
    })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Choose a valid reservation and payment provider." },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      await startCheckout(
        parsed.data.reference,
        current.user.id,
        parsed.data.provider,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof CheckoutError
            ? error.message
            : "Checkout is temporarily unavailable. Please try again.",
      },
      { status: error instanceof CheckoutError ? error.status : 503 },
    );
  }
}
