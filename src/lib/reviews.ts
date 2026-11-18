import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";

// A rental can be reviewed once the car is back.
export const REVIEWABLE_STATUSES = ["RETURNED", "CLOSED"];
export const reviewInput = z.object({
  reference: z.string().min(1).max(40),
  rating: z.number().int().min(1).max(5),
  body: z
    .string()
    .trim()
    .min(20, "Tell us a little more (at least 20 characters).")
    .max(1000),
  displayName: z
    .string()
    .trim()
    .min(2, "Add the name to show with your review.")
    .max(40),
});
// "Ama Mensah" → "Ama M.": a first name and initial by default.
export function shortName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : (first ?? "");
}
export type PublicReview = {
  id: string;
  name: string;
  text: string;
  rating: number;
  car: string;
};
// Reviews staff have approved and chosen to show on the website.
export async function publicReviews(
  db: PrismaClient | Prisma.TransactionClient,
  take = 8,
): Promise<PublicReview[]> {
  const rows = await db.review.findMany({
    where: { status: "APPROVED", featured: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take,
    include: { booking: { select: { vehicle: { select: { name: true } } } } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.displayName,
    text: r.body,
    rating: r.rating,
    car: r.booking.vehicle.name,
  }));
}
