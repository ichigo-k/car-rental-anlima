import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import {
  allowed,
  canTransition,
  chargeInput,
  reasonInput,
  settlement,
} from "@/lib/booking-lifecycle";
import { deliverSoon, queueBookingMessages } from "@/lib/notify";
import { ChangeError, changeBooking, changeInput } from "@/lib/booking-change";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CANCEL"), reason: reasonInput }),
  z.object({ action: z.literal("NO_SHOW") }),
  z.object({ action: z.literal("ADD_CHARGE"), charge: chargeInput }),
  z.object({
    action: z.literal("DECIDE_CHARGE"),
    chargeId: z.string().min(1).max(128),
    decision: z.enum(["APPROVED", "WAIVED"]),
  }),
  z.object({ action: z.literal("CLOSE") }),
  changeInput,
]);
const permission = {
  CANCEL: "cancel",
  NO_SHOW: "noShow",
  ADD_CHARGE: "proposeCharge",
  DECIDE_CHARGE: "decideCharge",
  CLOSE: "close",
  CHANGE: "change",
} as const;
class LifecycleError extends Error {}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let current;
  try {
    current = await requireStaff();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (
    req.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin
  )
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const input = parsed.data;
  if (!allowed(permission[input.action], current.user.role))
    return NextResponse.json(
      { error: "Your staff role cannot perform this action." },
      { status: 403 },
    );
  const { id } = await params;
  const actorId = current.user.id;
  if (input.action === "CHANGE") {
    try {
      const result = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${id} FOR UPDATE`;
        return changeBooking(tx, id, input, actorId);
      });
      if (!input.preview) deliverSoon();
      return NextResponse.json({ ok: true, change: result });
    } catch (e) {
      return NextResponse.json(
        {
          error:
            e instanceof ChangeError
              ? e.message
              : "Could not change this booking. Please try again.",
        },
        { status: 409 },
      );
    }
  }
  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${id} FOR UPDATE`;
      const b = await tx.booking.findUnique({
        where: { id },
        include: { charges: true },
      });
      if (!b) throw new LifecycleError("Booking not found.");
      const now = new Date();
      const audit = (action: string, detail: string) =>
        tx.auditEvent.create({
          data: { actorId, action, entityId: id, detail },
        });
      switch (input.action) {
        case "CANCEL":
          if (!canTransition(b.status, "CANCELLED"))
            throw new LifecycleError(
              "Only unpaid, confirmed or payment-review bookings can be cancelled before pickup.",
            );
          await tx.booking.update({
            where: { id },
            data: {
              status: "CANCELLED",
              cancelledAt: now,
              cancellationReason: input.reason,
            },
          });
          await queueBookingMessages(tx, id, "BOOKING_CANCELLED");
          return audit("BOOKING_CANCELLED", `${b.status}; ${input.reason}`);
        case "NO_SHOW":
          if (!canTransition(b.status, "NO_SHOW") || b.pickup > now)
            throw new LifecycleError(
              "A confirmed booking can be marked as a no-show only after its pickup time.",
            );
          await tx.booking.update({
            where: { id },
            data: { status: "NO_SHOW" },
          });
          return audit("BOOKING_NO_SHOW", "Customer did not collect");
        case "ADD_CHARGE": {
          if (!["CHECKED_OUT", "RETURNED", "NO_SHOW"].includes(b.status))
            throw new LifecycleError(
              "Charges can be added only to rentals on the road, returned or marked as no-shows.",
            );
          const charge = await tx.bookingCharge.create({
            data: { bookingId: id, ...input.charge, proposedBy: actorId },
          });
          return audit(
            "CHARGE_PROPOSED",
            `${charge.kind} ${charge.amount}; ${charge.reason}`,
          );
        }
        case "DECIDE_CHARGE": {
          const charge = b.charges.find((c) => c.id === input.chargeId);
          if (!charge || charge.status !== "PROPOSED" || b.status === "CLOSED")
            throw new LifecycleError("This charge has already been decided.");
          await tx.bookingCharge.update({
            where: { id: charge.id },
            data: {
              status: input.decision,
              decidedBy: actorId,
              decidedAt: now,
            },
          });
          return audit(
            `CHARGE_${input.decision}`,
            `${charge.kind} ${charge.amount}`,
          );
        }
        case "CLOSE": {
          if (!canTransition(b.status, "CLOSED"))
            throw new LifecycleError(
              "Only returned or no-show bookings can be closed.",
            );
          const result = settlement(b.deposit, b.charges);
          if (result.undecided)
            throw new LifecycleError(
              "Approve or waive every proposed charge before closing.",
            );
          await tx.booking.update({
            where: { id },
            data: {
              status: "CLOSED",
              closedAt: now,
              depositApplied: result.applied,
            },
          });
          await queueBookingMessages(tx, id, "REVIEW_REQUEST", ["customer"]);
          return audit(
            "BOOKING_CLOSED",
            `Deposit applied ${result.applied}; refund ${result.refund}; owed ${result.owed}`,
          );
        }
      }
    });
    deliverSoon();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof LifecycleError
            ? e.message
            : "Could not update this booking. Please try again.",
      },
      { status: 409 },
    );
  }
}
