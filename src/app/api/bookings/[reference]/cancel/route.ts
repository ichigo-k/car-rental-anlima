import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { session } from "@/lib/auth";
import { deliverSoon, queueBookingMessages } from "@/lib/notify";
// Customers cancel unpaid holds directly; paid bookings become a cancellation
// request because refunds follow ANLIMA's cancellation policy.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  if (
    req.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin
  )
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const current = await session().catch(() => null);
  if (!current)
    return NextResponse.json(
      { error: "Sign in to manage your booking." },
      { status: 401 },
    );
  const { reference } = await params;
  try {
    const result = await db.$transaction(async (tx) => {
      const b = await tx.booking.findUnique({ where: { reference } });
      if (!b || b.userId !== current.user.id) return null;
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${b.id} FOR UPDATE`;
      const fresh = await tx.booking.findUniqueOrThrow({ where: { id: b.id } });
      const now = new Date();
      if (fresh.status === "PENDING_PAYMENT") {
        await tx.booking.update({
          where: { id: b.id },
          data: {
            status: "CANCELLED",
            cancelledAt: now,
            cancellationReason: "Cancelled by customer before payment",
          },
        });
        await tx.auditEvent.create({
          data: {
            actorId: current.user.id,
            action: "BOOKING_CANCELLED",
            entityId: b.id,
            detail: "Customer cancelled unpaid hold",
          },
        });
        return "CANCELLED";
      }
      if (fresh.status === "CONFIRMED" && fresh.pickup > now) {
        if (!fresh.cancelRequestedAt) {
          await tx.booking.update({
            where: { id: b.id },
            data: { cancelRequestedAt: now },
          });
          await tx.auditEvent.create({
            data: {
              actorId: current.user.id,
              action: "CANCELLATION_REQUESTED",
              entityId: b.id,
              detail: "Customer requested cancellation of a paid booking",
            },
          });
          await queueBookingMessages(tx, b.id, "CANCELLATION_REQUESTED", [
            "operations",
          ]);
        }
        return "REQUESTED";
      }
      throw new Error("not-cancellable");
    });
    if (!result)
      return NextResponse.json(
        { error: "Booking not found." },
        { status: 404 },
      );
    deliverSoon();
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json(
      {
        error:
          "This booking can no longer be cancelled online. Contact the ANLIMA team for help.",
      },
      { status: 409 },
    );
  }
}
