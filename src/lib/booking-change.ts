import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getFees } from "./fees";
import { blockingWhere, overlaps, priceRental } from "./pricing";
import { reasonInput } from "./booking-lifecycle";
import { queueBookingMessages } from "./notify";

type Tx = Prisma.TransactionClient;
export class ChangeError extends Error {}

// Why a car cannot be held for an interval, or null when it is free. Other
// bookings that hold the car and maintenance blocks both count; the booking
// being changed is ignored. Callers lock the vehicle row first.
export async function vehicleConflict(
  tx: Tx,
  vehicleId: string,
  pickup: Date,
  returnAt: Date,
  now: Date,
  ignoreBookingId?: string,
) {
  const car = await tx.vehicle.findUnique({ where: { id: vehicleId } });
  if (!car || car.status !== "AVAILABLE")
    return "This car is not available for rental.";
  const booking = await tx.booking.findFirst({
    where: {
      vehicleId,
      ...(ignoreBookingId ? { id: { not: ignoreBookingId } } : {}),
      ...overlaps(pickup, returnAt),
      ...blockingWhere(now),
    },
    select: { reference: true },
  });
  if (booking)
    return `This car is already booked for part of that time (${booking.reference}).`;
  const block = await tx.vehicleBlock.findFirst({
    where: { vehicleId, start: { lt: returnAt }, end: { gt: pickup } },
  });
  if (block) return "This car is blocked for maintenance during that time.";
  return null;
}

// Staff change to a confirmed booking's car or dates, or to the return time
// of a car on the road (Guide AC-05). Times are ISO strings.
export const changeInput = z.object({
  action: z.literal("CHANGE"),
  vehicleId: z.string().min(1).max(128),
  pickup: z.string().datetime(),
  returnAt: z.string().datetime(),
  reason: z.string().trim().max(500).optional(),
  chargeDifference: z.boolean().default(false),
  preview: z.boolean().default(false),
});
export type ChangeInput = z.infer<typeof changeInput>;

// The rental part of a price: rental less the length-of-rental discount, plus
// extras. Deposits and promotions are left as they were when the customer paid.
const rentalPrice = (p: {
  rentalAmount: number;
  durationDiscount: number;
  extrasAmount: number;
}) => p.rentalAmount - p.durationDiscount + p.extrasAmount;

export async function changeBooking(
  tx: Tx,
  bookingId: string,
  input: ChangeInput,
  actorId: string,
  now = new Date(),
) {
  const b = await tx.booking.findUnique({ where: { id: bookingId } });
  if (!b) throw new ChangeError("Booking not found.");
  const pickup = new Date(input.pickup);
  const returnAt = new Date(input.returnAt);
  const onRoad = b.status === "CHECKED_OUT";
  if (b.status !== "CONFIRMED" && !onRoad)
    throw new ChangeError(
      "Only confirmed bookings, or the return time of a car on the road, can be changed.",
    );
  if (
    onRoad &&
    (input.vehicleId !== b.vehicleId || pickup.getTime() !== b.pickup.getTime())
  )
    throw new ChangeError(
      "The car is already on the road: only its return time can change.",
    );
  if (!onRoad && pickup <= now)
    throw new ChangeError("The new pickup time must be in the future.");
  if (returnAt <= pickup || (onRoad && returnAt <= now))
    throw new ChangeError("The new return time must be after pickup and now.");
  if (
    input.vehicleId === b.vehicleId &&
    pickup.getTime() === b.pickup.getTime() &&
    returnAt.getTime() === b.returnAt.getTime()
  )
    throw new ChangeError("Nothing has changed.");
  await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id = ${input.vehicleId} FOR UPDATE`;
  const car = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
  if (!car) throw new ChangeError("Choose a car from the fleet.");
  if (car.id !== b.vehicleId && !car.pickupPoints.includes(b.location))
    throw new ChangeError(
      `The ${car.name} cannot be collected from ${b.location}.`,
    );
  let pricing;
  try {
    pricing = priceRental(
      pickup,
      returnAt,
      car,
      {
        withDriver: b.withDriver,
        delivery: !!b.deliveryAddress,
        extraDriver: !!b.extraDriverName,
      },
      await getFees(tx),
    );
  } catch (e) {
    throw new ChangeError((e as Error).message);
  }
  const difference = rentalPrice(pricing) - rentalPrice(b);
  const conflict = await vehicleConflict(
    tx,
    car.id,
    pickup,
    returnAt,
    now,
    b.id,
  );
  const summary = {
    available: !conflict,
    problem: conflict,
    vehicle: car.name,
    days: pricing.days,
    dailyRate: pricing.dailyRate,
    difference,
    depositHeld: b.deposit,
    carDeposit: car.deposit,
  };
  if (input.preview) return summary;
  if (conflict) throw new ChangeError(conflict);
  if (!input.reason || input.reason.length < 5)
    throw new ChangeError(
      "Give a reason for the change (5 characters or more).",
    );
  reasonInput.parse(input.reason);
  const charge =
    input.chargeDifference && difference > 0
      ? await tx.bookingCharge.create({
          data: {
            bookingId: b.id,
            kind: "BOOKING_CHANGE",
            amount: difference,
            reason: `Booking change: ${input.reason}`,
            proposedBy: actorId,
          },
        })
      : null;
  const change = await tx.bookingChange.create({
    data: {
      bookingId: b.id,
      fromVehicleId: b.vehicleId,
      toVehicleId: car.id,
      fromPickup: b.pickup,
      toPickup: pickup,
      fromReturn: b.returnAt,
      toReturn: returnAt,
      priceDifference: difference,
      chargeId: charge?.id,
      reason: input.reason,
      changedBy: actorId,
    },
  });
  // The amount paid is unchanged; the operational details move with the change.
  await tx.booking.update({
    where: { id: b.id },
    data: {
      vehicleId: car.id,
      pickup,
      returnAt,
      days: pricing.days,
      dailyRate: pricing.dailyRate,
    },
  });
  await tx.auditEvent.create({
    data: {
      actorId,
      action: "BOOKING_CHANGED",
      entityId: b.id,
      detail: `${b.vehicleId} ${b.pickup.toISOString()}–${b.returnAt.toISOString()} → ${car.id} ${pickup.toISOString()}–${returnAt.toISOString()}; difference ${difference}${charge ? " charged" : ""}; ${input.reason}`,
    },
  });
  await queueBookingMessages(
    tx,
    b.id,
    "BOOKING_CHANGED",
    ["customer", "operations"],
    change.id,
  );
  return summary;
}
