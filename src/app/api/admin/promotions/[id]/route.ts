import { NextResponse } from "next/server";
import { session } from "@/lib/auth";
import { trustedOrigin } from "@/lib/request";
import { promotionInput } from "@/lib/promotion-input";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const current = await session();
    if (!current)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    if (
      !trustedOrigin(req) ||
      !current.user.twoFactorEnabled ||
      !can(current.user.role, "promotion.manage")
    )
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = promotionInput.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    const p = parsed.data;
    const { id } = await params;
    if (
      (await db.vehicle.count({ where: { id: { in: p.vehicleIds } } })) !==
      p.vehicleIds.length
    )
      return NextResponse.json(
        { error: "Choose valid vehicles." },
        { status: 400 },
      );
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Promotion" WHERE id = ${id} FOR UPDATE`;
      await tx.promotion.update({
        where: { id },
        data: {
          ...p,
          startsAt: new Date(p.startsAt),
          endsAt: new Date(p.endsAt),
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: current.user.id,
          action: "PROMOTION_UPDATED",
          entityId: id,
          detail: p.name,
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not update this promotion. Check the fields and unique coupon code.",
      },
      { status: 400 },
    );
  }
}
// Removes a promotion for good. Bookings that used it keep their discount and
// the promotion's name; only the link to it is cleared.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const current = await session();
  if (!current)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (
    !trustedOrigin(req) ||
    !current.user.twoFactorEnabled ||
    !can(current.user.role, "promotion.manage")
  )
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const promotion = await db.promotion
    .delete({ where: { id } })
    .catch(() => null);
  if (!promotion)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.auditEvent.create({
    data: {
      actorId: current.user.id,
      action: "PROMOTION_DELETED",
      entityId: id,
      detail: promotion.code
        ? `${promotion.name} (${promotion.code})`
        : promotion.name,
    },
  });
  return NextResponse.json({ ok: true });
}
