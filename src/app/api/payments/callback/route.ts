import { NextResponse } from "next/server";
import { verifyPayment } from "@/lib/paystack";
export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    await verifyPayment(url.searchParams.get("reference") ?? "");
    return NextResponse.redirect(
      new URL("/bookings?payment=verified", process.env.BETTER_AUTH_URL),
    );
  } catch {
    return NextResponse.redirect(
      new URL("/bookings?payment=pending", process.env.BETTER_AUTH_URL),
    );
  }
}
