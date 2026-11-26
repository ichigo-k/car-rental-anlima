import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { trustedOrigin } from "@/lib/request";
import { RefundError, issueRefund } from "@/lib/refunds";
const schema = z.object({
  amount: z.number().int().positive().max(100000000),
  reason: z.string().trim().min(5).max(500),
});
// Refunds part or all of a verified payment through its provider.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let current;
  try {
    current = await requireStaff("payment.refund");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!trustedOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Enter the amount and a reason of at least 5 characters." },
      { status: 400 },
    );
  const { id } = await params;
  try {
    const refund = await issueRefund({
      paymentId: id,
      ...parsed.data,
      actorId: current.user.id,
    });
    return NextResponse.json({ refund });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof RefundError
            ? e.message
            : "The refund could not be started. Please try again.",
      },
      { status: 409 },
    );
  }
}
