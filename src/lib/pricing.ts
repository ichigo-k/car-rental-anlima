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
export const blockingWhere = (now: Date) => ({
  OR: [
    { status: { in: ["CONFIRMED", "ACTIVE"] } },
    { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } },
  ],
});
export const overlaps = (pickup: Date, returnAt: Date) => ({
  pickup: { lt: returnAt },
  returnAt: { gt: pickup },
});
