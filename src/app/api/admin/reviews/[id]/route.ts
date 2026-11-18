import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
const schema = z.object({
  action: z.enum([
    "APPROVE",
    "HIDE",
    "FEATURE",
    "UNFEATURE",
    "MOVE_UP",
    "MOVE_DOWN",
  ]),
});
// Staff approve, hide, feature and reorder reviews. The customer's words
// are never edited.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let current;
  try {
    current = await requireStaff("review.manage");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (
    req.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin
  )
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const { action } = parsed.data;
  const { id } = await params;
  const result = await db.$transaction(async (tx) => {
    const review = await tx.review.findUnique({ where: { id } });
    if (!review) return "Review not found.";
    const decided = { decidedBy: current.user.id, decidedAt: new Date() };
    if (action === "APPROVE")
      await tx.review.update({
        where: { id },
        data: { status: "APPROVED", ...decided },
      });
    else if (action === "HIDE")
      await tx.review.update({
        where: { id },
        data: { status: "HIDDEN", featured: false, ...decided },
      });
    else if (action === "FEATURE" || action === "UNFEATURE") {
      if (action === "FEATURE" && review.status !== "APPROVED")
        return "Approve the review before showing it on the website.";
      const last = await tx.review.aggregate({
        where: { featured: true },
        _max: { sortOrder: true },
      });
      await tx.review.update({
        where: { id },
        data:
          action === "FEATURE"
            ? { featured: true, sortOrder: (last._max.sortOrder ?? 0) + 1 }
            : { featured: false },
      });
    } else {
      // Swap with the neighbouring featured review.
      const featured = await tx.review.findMany({
        where: { featured: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: { id: true },
      });
      const at = featured.findIndex((r) => r.id === id);
      const to = at + (action === "MOVE_UP" ? -1 : 1);
      if (at < 0 || to < 0 || to >= featured.length) return null;
      [featured[at], featured[to]] = [featured[to], featured[at]];
      for (const [i, r] of featured.entries())
        await tx.review.update({ where: { id: r.id }, data: { sortOrder: i } });
    }
    await tx.auditEvent.create({
      data: {
        actorId: current.user.id,
        action: `REVIEW_${action}`,
        entityId: id,
        detail: `${review.rating}★ by ${review.displayName}`,
      },
    });
    return null;
  });
  if (result) return NextResponse.json({ error: result }, { status: 409 });
  return NextResponse.json({ ok: true });
}
