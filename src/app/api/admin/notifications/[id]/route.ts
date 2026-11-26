import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { deliverSoon } from "@/lib/notify";
// Puts a message back in the queue to be sent again (Guide §6: authorised
// staff can resend). The dedupe key stays, so this re-sends the same message.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let current;
  try {
    current = await requireStaff("booking.write");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (
    req.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin
  )
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const { id } = await params;
  const updated = await db.notification.updateMany({
    where: { id, status: { in: ["FAILED", "SENT"] } },
    data: {
      status: "QUEUED",
      attempts: 0,
      nextAttemptAt: new Date(),
      lastError: null,
    },
  });
  if (!updated.count)
    return NextResponse.json(
      { error: "This message is already waiting to be sent." },
      { status: 409 },
    );
  await db.auditEvent.create({
    data: {
      actorId: current.user.id,
      action: "NOTIFICATION_RESENT",
      entityId: id,
      detail: "Message queued again",
    },
  });
  deliverSoon();
  return NextResponse.json({ ok: true });
}
