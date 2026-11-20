import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { trustedOrigin } from "@/lib/request";
import { RefundError, refreshRefund, resolveRefund } from "@/lib/refunds";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CHECK") }),
  z.object({
    action: z.literal("RESOLVE"),
    sent: z.boolean(),
    providerRefundId: z.string().trim().max(100).optional(),
  }),
]);
// CHECK asks the provider for the latest status; RESOLVE records what staff
// found in the provider's dashboard for a refund whose outcome was lost.
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
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { id } = await params;
  try {
    if (parsed.data.action === "CHECK") {
      const refund = await db.refund.findUnique({
        where: { id },
        include: { payment: { select: { provider: true } } },
      });
      if (!refund)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ refund: await refreshRefund(refund) });
    }
    const refund = await resolveRefund({
      refundId: id,
      sent: parsed.data.sent,
      providerRefundId: parsed.data.providerRefundId || undefined,
      actorId: current.user.id,
    });
    return NextResponse.json({ refund });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof RefundError ? e.message : "Could not update the refund.",
      },
      { status: 409 },
    );
  }
}
