import { db } from "./db";
import { blockingWhere, bookingWindowIssue, overlaps, quote } from "./pricing";
export type CarSearch = Record<string, string | undefined>;
// Cars free for the searched dates (and pickup point): no overlapping booking
// or staff block. Also returns the query string car pages carry the dates in.
export async function searchCars(q: CarSearch) {
  let error = "";
  let interval = {};
  try {
    if (!q.pickup || !q.returnAt)
      throw new Error("Choose both a pickup and return date.");
    const start = new Date(q.pickup),
      end = new Date(q.returnAt);
    quote(start, end, 1, 0);
    const issue = bookingWindowIssue(start, end);
    if (issue) throw new Error(issue);
    interval = {
      bookings: {
        none: { ...overlaps(start, end), ...blockingWhere(new Date()) },
      },
      blocks: { none: { start: { lt: end }, end: { gt: start } } },
    };
  } catch (e) {
    error = (e as Error).message;
  }
  if (error) return { error, cars: [], query: "" };
  const cars = await db.vehicle.findMany({
    where: {
      status: "AVAILABLE",
      ...interval,
      ...(q.location ? { pickupPoints: { has: q.location } } : {}),
    },
    orderBy: { dailyRate: "asc" },
  });
  const query = `?${new URLSearchParams({
    pickup: q.pickup!,
    returnAt: q.returnAt!,
    ...(q.location ? { location: q.location } : {}),
  })}`;
  return { error, cars, query };
}
