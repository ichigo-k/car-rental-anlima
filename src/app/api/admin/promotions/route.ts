import { NextResponse } from "next/server";
import { session } from "@/lib/auth";
import { trustedOrigin } from "@/lib/request";
import { promotionInput } from "@/lib/promotion-input";
import { db } from "@/lib/db";
export async function POST(req: Request) {
  try {
    const current = await session();
    if (!current)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    if (
      !trustedOrigin(req) ||
      !["ADMIN", "MANAGER"].includes(current.user.role)
    )
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = promotionInput.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    const p = parsed.data;
    if (
      (await db.vehicle.count({ where: { id: { in: p.vehicleIds } } })) !==
      p.vehicleIds.length
    )
      return NextResponse.json(
        { error: "Choose valid vehicles." },
        { status: 400 },
      );
    const promotion = await db.$transaction(async (tx) => {
      const created = await tx.promotion.create({
        data: {
          ...p,
          startsAt: new Date(p.startsAt),
          endsAt: new Date(p.endsAt),
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: current.user.id,
          action: "PROMOTION_CREATED",
          entityId: created.id,
          detail: created.name,
        },
      });
      return created;
    });
    return NextResponse.json({ id: promotion.id });
  } catch {
    return NextResponse.json(
      { error: "Could not save this promotion. Coupon codes must be unique." },
      { status: 400 },
    );
  }
}
