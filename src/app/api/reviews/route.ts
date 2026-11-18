import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { session } from "@/lib/auth";
import { REVIEWABLE_STATUSES, reviewInput } from "@/lib/reviews";
// A customer reviews their own returned rental, once. Reviews wait for
// staff approval before they can appear on the website.
export async function POST(req: Request) {
  if (
    req.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin
  )
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const current = await session().catch(() => null);
  if (!current)
    return NextResponse.json(
      { error: "Sign in to leave a review." },
      { status: 401 },
    );
  const parsed = reviewInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const input = parsed.data;
  const booking = await db.booking.findUnique({
    where: { reference: input.reference },
    select: { id: true, userId: true, status: true },
  });
  if (!booking || booking.userId !== current.user.id)
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (!REVIEWABLE_STATUSES.includes(booking.status))
    return NextResponse.json(
      { error: "You can review a rental once the car has been returned." },
      { status: 409 },
    );
  try {
    await db.review.create({
      data: {
        bookingId: booking.id,
        userId: current.user.id,
        rating: input.rating,
        body: input.body,
        displayName: input.displayName,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return NextResponse.json(
        { error: "You have already reviewed this rental." },
        { status: 409 },
      );
    throw e;
  }
  return NextResponse.json({ ok: true });
}
