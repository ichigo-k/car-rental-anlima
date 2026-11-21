import { money } from "./catalogue";
import { durationDiscountPercent, type Fees } from "./fees";
// Customer bookings need notice to prepare the car and check documents, and
// last at least a day (a shorter rental is still charged as a full day).
export const MIN_NOTICE_HOURS = 2;
export const MIN_RENTAL_HOURS = 24;
export function bookingWindowIssue(
  pickup: Date,
  returnAt: Date,
  now = new Date(),
) {
  if (!(pickup.getTime() >= now.getTime() + MIN_NOTICE_HOURS * 3600000))
    return `Pick-up must be at least ${MIN_NOTICE_HOURS} hours from now.`;
  if (!(returnAt.getTime() - pickup.getTime() >= MIN_RENTAL_HOURS * 3600000))
    return `The shortest rental is ${MIN_RENTAL_HOURS} hours. Choose a later return.`;
  return null;
}
export function quote(
  pickup: Date,
  returnAt: Date,
  dailyRate: number,
  deposit: number,
) {
  if (
    !Number.isFinite(pickup.getTime()) ||
    !Number.isFinite(returnAt.getTime()) ||
    returnAt <= pickup
  )
    throw new Error("Choose a return time after pickup.");
  const days = Math.ceil((returnAt.getTime() - pickup.getTime()) / 86400000);
  if (days > 90)
    throw new Error("For rentals longer than 90 days, contact our team.");
  return {
    days,
    dailyRate,
    rentalAmount: days * dailyRate,
    deposit,
    total: days * dailyRate + deposit,
  };
}
export type DriverOption = "SELF_DRIVE" | "BOTH" | "CHAUFFEUR_ONLY";
export type RentalOptions = {
  withDriver: boolean;
  delivery: boolean;
  extraDriver: boolean;
};
export const NO_OPTIONS: RentalOptions = {
  withDriver: false,
  delivery: false,
  extraDriver: false,
};
export type QuoteItem = { kind: string; label: string; amount: number };
export class PricingError extends Error {}

// The full price of a rental: the daily rate for the chosen service, less the
// length-of-rental discount, plus extras and the refundable deposit. Every
// quote, booking and receipt uses this one calculation.
export function priceRental(
  pickup: Date,
  returnAt: Date,
  car: {
    dailyRate: number;
    deposit: number;
    driverOption: string;
    withDriverRate: number | null;
  },
  options: RentalOptions,
  fees: Fees,
) {
  if (car.driverOption === "CHAUFFEUR_ONLY" && !options.withDriver)
    throw new PricingError("This car is only available with an ANLIMA driver.");
  if (
    options.withDriver &&
    (car.driverOption === "SELF_DRIVE" || !car.withDriverRate)
  )
    throw new PricingError("This car is available for self-drive only.");
  if (options.withDriver && options.extraDriver)
    throw new PricingError(
      "An additional driver is only needed for self-drive rentals.",
    );
  const rate = options.withDriver ? car.withDriverRate! : car.dailyRate;
  const base = quote(pickup, returnAt, rate, car.deposit);
  const percent = durationDiscountPercent(fees, base.days);
  const durationDiscount = Math.round((base.rentalAmount * percent) / 100);
  const items: QuoteItem[] = [
    {
      kind: "RENTAL",
      label: `${base.days} day${base.days === 1 ? "" : "s"} × ${money(rate)}${options.withDriver ? " with driver" : ""}`,
      amount: base.rentalAmount,
    },
  ];
  if (durationDiscount) {
    const tier =
      base.days >= 30 ? 30 : base.days >= 14 ? 14 : base.days >= 7 ? 7 : 3;
    items.push({
      kind: "DURATION_DISCOUNT",
      label: `${percent}% off rentals of ${tier}+ days`,
      amount: -durationDiscount,
    });
  }
  if (options.delivery)
    items.push({
      kind: "DELIVERY",
      label: "Delivery and collection",
      amount: fees.deliveryFee,
    });
  if (options.extraDriver)
    items.push({
      kind: "EXTRA_DRIVER",
      label: "Additional authorised driver",
      amount: fees.extraDriverFee,
    });
  const extrasAmount =
    (options.delivery ? fees.deliveryFee : 0) +
    (options.extraDriver ? fees.extraDriverFee : 0);
  items.push({
    kind: "DEPOSIT",
    label: "Refundable security deposit",
    amount: car.deposit,
  });
  return {
    ...base,
    withDriver: options.withDriver,
    durationPercent: percent,
    durationDiscount,
    extrasAmount,
    items,
    total: base.rentalAmount - durationDiscount + extrasAmount + car.deposit,
  };
}
export const blockingWhere = (now: Date) => ({
  OR: [
    { status: { in: ["CONFIRMED", "CHECKED_OUT"] } },
    { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } },
  ],
});
export const overlaps = (pickup: Date, returnAt: Date) => ({
  pickup: { lt: returnAt },
  returnAt: { gt: pickup },
});
