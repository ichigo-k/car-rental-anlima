import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";

// ANLIMA sets these in the admin dashboard (Fees & settings). Amounts are
// pesewas. Until a schedule is saved, the defaults below apply; they follow
// ANLIMA's "Accra Car Rental Market and Recommended Pricing" (Nov 2026).
export type Fees = {
  lateGraceMinutes: number;
  lateHourPercent: number;
  fuelPerQuarter: number;
  cleaningFee: number;
  smokingFee: number;
  dailyKmAllowance: number | null;
  excessKmFee: number;
  freeCancellationHours: number;
  lateCancellationPercent: number;
  discount3Days: number;
  discount7Days: number;
  discount14Days: number;
  discount30Days: number;
  deliveryFee: number;
  extraDriverFee: number;
  driverOvertimeHourly: number;
};
export const DEFAULT_FEES: Fees = {
  lateGraceMinutes: 60,
  lateHourPercent: 10,
  fuelPerQuarter: 0,
  cleaningFee: 50000,
  smokingFee: 50000,
  dailyKmAllowance: null,
  excessKmFee: 0,
  freeCancellationHours: 48,
  lateCancellationPercent: 0,
  discount3Days: 5,
  discount7Days: 10,
  discount14Days: 15,
  discount30Days: 20,
  deliveryFee: 15000,
  extraDriverFee: 10000,
  driverOvertimeHourly: 5000,
};
const money = z.number().int().min(0).max(100000000);
const percent = z.number().int().min(0).max(100);
export const feeInput = z.object({
  lateGraceMinutes: z.number().int().min(0).max(1440),
  lateHourPercent: percent,
  fuelPerQuarter: money,
  cleaningFee: money,
  smokingFee: money,
  dailyKmAllowance: z.number().int().min(1).max(10000).nullable(),
  excessKmFee: money,
  freeCancellationHours: z.number().int().min(0).max(8760),
  lateCancellationPercent: percent,
  discount3Days: percent,
  discount7Days: percent,
  discount14Days: percent,
  discount30Days: percent,
  deliveryFee: money,
  extraDriverFee: money,
  driverOvertimeHourly: money,
});

type Reader = PrismaClient | Prisma.TransactionClient;
export async function getFees(db: Reader): Promise<Fees> {
  const row = await db.feeSettings.findUnique({ where: { id: "default" } });
  if (!row) return DEFAULT_FEES;
  const { id, updatedAt, updatedBy, ...fees } = row;
  void id;
  void updatedAt;
  void updatedBy;
  return fees;
}

// Longer rentals earn a percentage off the rental amount.
export function durationDiscountPercent(fees: Fees, days: number) {
  if (days >= 30) return fees.discount30Days;
  if (days >= 14) return fees.discount14Days;
  if (days >= 7) return fees.discount7Days;
  if (days >= 3) return fees.discount3Days;
  return 0;
}

export const FUEL_LEVELS = [
  "Empty",
  "Quarter",
  "Half",
  "Three quarters",
  "Full",
] as const;
type Proposal = {
  kind: "LATE" | "FUEL" | "MILEAGE";
  amount: number;
  reason: string;
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Charges proposed automatically when a return is recorded. Staff still
// approve or waive each one. A car's own mileage rules override the defaults.
export function returnCharges(
  fees: Fees,
  booking: {
    returnAt: Date;
    dailyRate: number;
    days: number;
    vehicle?: { dailyKmAllowance: number | null; excessKmFee: number | null };
  },
  out: { fuel: string; mileage: number } | undefined,
  back: { fuel: string; mileage: number; at: Date },
): Proposal[] {
  const charges: Proposal[] = [];
  const lateMs =
    back.at.getTime() -
    booking.returnAt.getTime() -
    fees.lateGraceMinutes * 60000;
  if (lateMs > 0 && fees.lateHourPercent > 0) {
    // Each started hour costs a share of the daily rate, capped at one day's
    // rate for every 24 hours late.
    const hours = Math.ceil(lateMs / 3600000);
    const fullDays = Math.floor(hours / 24);
    const hourly = Math.round((booking.dailyRate * fees.lateHourPercent) / 100);
    const amount =
      fullDays * booking.dailyRate +
      Math.min((hours % 24) * hourly, booking.dailyRate);
    charges.push({
      kind: "LATE",
      amount,
      reason: `Returned ${plural(hours, "hour")} late after the ${fees.lateGraceMinutes}-minute grace period, at ${fees.lateHourPercent}% of the daily rate per hour, capped at the daily rate per day.`,
    });
  }
  if (!out) return charges;
  const quarters =
    FUEL_LEVELS.indexOf(out.fuel as (typeof FUEL_LEVELS)[number]) -
    FUEL_LEVELS.indexOf(back.fuel as (typeof FUEL_LEVELS)[number]);
  if (quarters > 0 && fees.fuelPerQuarter > 0)
    charges.push({
      kind: "FUEL",
      amount: quarters * fees.fuelPerQuarter,
      reason: `Fuel returned ${plural(quarters, "quarter tank")} lower than at pickup (${out.fuel} → ${back.fuel}).`,
    });
  const allowance = booking.vehicle?.dailyKmAllowance ?? fees.dailyKmAllowance;
  const perKm = booking.vehicle?.excessKmFee ?? fees.excessKmFee;
  if (allowance !== null && perKm > 0) {
    const excess = back.mileage - out.mileage - allowance * booking.days;
    if (excess > 0)
      charges.push({
        kind: "MILEAGE",
        amount: excess * perKm,
        reason: `${excess.toLocaleString("en-GB")} km over the ${allowance} km per day allowance for ${plural(booking.days, "day")}.`,
      });
  }
  return charges;
}

// How much of the rental amount ANLIMA keeps when a paid booking is
// cancelled. The deposit is always refundable.
export function cancellationTerms(
  fees: Fees,
  booking: { pickup: Date; rentalAmount: number },
  now = new Date(),
) {
  const hoursBefore = (booking.pickup.getTime() - now.getTime()) / 3600000;
  const free = hoursBefore >= fees.freeCancellationHours;
  return {
    free,
    retained: free
      ? 0
      : Math.round((booking.rentalAmount * fees.lateCancellationPercent) / 100),
  };
}
