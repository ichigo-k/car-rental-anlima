import { NextResponse } from "next/server";
import { verifyFlutterwave } from "@/lib/flutterwave";
import { paymentReturnUrl } from "@/lib/payment-status";
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (
    !q.get("transaction_id") &&
    ["cancelled", "failed"].includes(q.get("status") ?? "")
  )
    return NextResponse.redirect(paymentReturnUrl("cancelled"));
  try {
    const result = await verifyFlutterwave(
      q.get("tx_ref") ?? "",
      q.get("transaction_id") ?? undefined,
    );
    return NextResponse.redirect(
      paymentReturnUrl(result.review ? "review" : "verified", result.reference),
    );
  } catch {
    return NextResponse.redirect(paymentReturnUrl("pending"));
  }
}
