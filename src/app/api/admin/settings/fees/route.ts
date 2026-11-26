import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { feeInput, getFees, type Fees } from "@/lib/fees";
export async function PUT(req: Request) {
  let current;
  try {
    current = await requireStaff("settings.manage");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (
    req.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin
  )
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const parsed = feeInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const fees = parsed.data;
  await db.$transaction(async (tx) => {
    const before = await getFees(tx);
    await tx.feeSettings.upsert({
      where: { id: "default" },
      create: { ...fees, updatedBy: current.user.id },
      update: { ...fees, updatedBy: current.user.id },
    });
    const changes = (Object.keys(fees) as (keyof Fees)[])
      .filter((k) => before[k] !== fees[k])
      .map((k) => `${k}: ${before[k] ?? "none"} → ${fees[k] ?? "none"}`);
    await tx.auditEvent.create({
      data: {
        actorId: current.user.id,
        action: "FEES_UPDATED",
        entityId: "fee-settings",
        detail: changes.join("; ") || "No changes",
      },
    });
  });
  return NextResponse.json({ ok: true });
}
