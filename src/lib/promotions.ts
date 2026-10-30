import { Prisma } from "@prisma/client";
import { discountFor } from "./discount";
export class CouponError extends Error {}
export async function promotionQuote(
  tx: Prisma.TransactionClient,
  vehicleId: string,
  rentalAmount: number,
  code: string | undefined,
  now: Date,
  lock = false,
) {
  let candidates = await tx.promotion.findMany({
    where: {
      active: true,
      startsAt: { lte: now },
      endsAt: { gt: now },
      code: code || null,
      minimumRental: { lte: rentalAmount },
      OR: [
        { vehicleIds: { isEmpty: true } },
        { vehicleIds: { has: vehicleId } },
      ],
    },
  });
  if (lock && candidates.length) {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "Promotion" WHERE id IN (${Prisma.join(candidates.map((p) => p.id))}) ORDER BY id FOR UPDATE`,
    );
    candidates = await tx.promotion.findMany({
      where: { id: { in: candidates.map((p) => p.id) } },
    });
  }
  candidates.sort(
    (a, b) =>
      discountFor(rentalAmount, b.discountType, b.value) -
        discountFor(rentalAmount, a.discountType, a.value) ||
      a.id.localeCompare(b.id),
  );
  for (const candidate of candidates) {
    const p = candidate;
    if (
      !p ||
      !p.active ||
      p.startsAt > now ||
      p.endsAt <= now ||
      p.code !== (code || null) ||
      p.minimumRental > rentalAmount ||
      (p.vehicleIds.length && !p.vehicleIds.includes(vehicleId))
    )
      continue;
    if (p.maxUses !== null) {
      const used = await tx.booking.count({
        where: {
          promotionId: p.id,
          OR: [
            {
              status: {
                in: ["CONFIRMED", "ACTIVE", "COMPLETED", "PAYMENT_REVIEW"],
              },
            },
            { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } },
          ],
        },
      });
      if (used >= p.maxUses) continue;
    }
    const discountAmount = discountFor(rentalAmount, p.discountType, p.value);
    if (discountAmount > 0)
      return {
        discountAmount,
        promotionId: p.id,
        promotionName: p.name,
        couponCode: p.code,
      };
  }
  if (code)
    throw new CouponError(
      "This coupon is invalid, expired, fully used, or does not apply to this car or rental amount.",
    );
  return {
    discountAmount: 0,
    promotionId: null,
    promotionName: null,
    couponCode: null,
  };
}
