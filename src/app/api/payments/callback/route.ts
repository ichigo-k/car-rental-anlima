import { NextResponse } from "next/server";
import { verifyPayment } from "@/lib/paystack";
import { paymentReturnUrl } from "@/lib/payment-status";
export async function GET(req: Request) {
  try {
    const result = await verifyPayment(
      new URL(req.url).searchParams.get("reference") ?? "",
    );
    return NextResponse.redirect(
      paymentReturnUrl(result.review ? "review" : "verified", result.reference),
    );
  } catch {
    return NextResponse.redirect(paymentReturnUrl("pending"));
  }
}
