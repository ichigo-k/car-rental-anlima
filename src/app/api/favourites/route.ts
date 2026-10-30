import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { session } from "@/lib/auth";
import { trustedOrigin } from "@/lib/request";
import { isStaffRole } from "@/lib/auth-redirect";

export async function GET() {
  const current = await session();
  const favourites =
    current && !isStaffRole(current.user.role)
      ? await db.favourite.findMany({
          where: { userId: current.user.id },
          select: { vehicleId: true },
        })
      : [];
  return NextResponse.json(
    {
      authenticated: !!current,
      role: current?.user.role ?? null,
      vehicleIds: favourites.map((f) => f.vehicleId),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
async function update(req: Request, remove: boolean) {
  if (!trustedOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const current = await session();
  if (!current)
    return NextResponse.json(
      { error: "Sign in to save cars." },
      { status: 401 },
    );
  const parsed = z
    .object({ vehicleId: z.string().min(1).max(128) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Choose a valid vehicle." },
      { status: 400 },
    );
  const vehicleId = parsed.data.vehicleId;
  if (
    !(await db.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    }))
  )
    return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  if (remove)
    await db.favourite.deleteMany({
      where: { userId: current.user.id, vehicleId },
    });
  else
    await db.favourite.upsert({
      where: { userId_vehicleId: { userId: current.user.id, vehicleId } },
      create: { userId: current.user.id, vehicleId },
      update: {},
    });
  return NextResponse.json({ saved: !remove });
}
export const PUT = (req: Request) => update(req, false);
export const DELETE = (req: Request) => update(req, true);
