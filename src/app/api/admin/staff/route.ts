import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/permissions";
const role = z.enum(STAFF_ROLES);
const userId = z.string().min(1).max(128);
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("GRANT"),
    email: z.email().max(254),
    role,
  }),
  z.object({ action: z.literal("SET_ROLE"), userId, role }),
  z.object({ action: z.literal("REVOKE"), userId }),
  z.object({ action: z.literal("RESET_MFA"), userId }),
  z.object({ action: z.literal("SIGN_OUT"), userId }),
]);
class StaffError extends Error {}
export async function POST(req: Request) {
  let current;
  try {
    current = await requireStaff("user.manage");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (
    req.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin
  )
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const input = parsed.data;
  const actorId = current.user.id;
  try {
    await db.$transaction(async (tx) => {
      // Serialise access changes so the last administrator cannot be removed
      // by two concurrent requests.
      await tx.$queryRaw`SELECT id FROM "User" WHERE role = 'ADMIN' FOR UPDATE`;
      const target =
        input.action === "GRANT"
          ? await tx.user.findUnique({
              where: { email: input.email.toLowerCase() },
              include: { accounts: { select: { providerId: true } } },
            })
          : await tx.user.findUnique({
              where: { id: input.userId },
              include: { accounts: { select: { providerId: true } } },
            });
      if (!target)
        throw new StaffError(
          input.action === "GRANT"
            ? "No account uses that email. Ask the person to create an account first."
            : "Staff member not found.",
        );
      if (target.id === actorId)
        throw new StaffError(
          "You cannot change your own access. Ask another administrator.",
        );
      const isStaff = (STAFF_ROLES as readonly string[]).includes(target.role);
      if (input.action === "GRANT" && isStaff)
        throw new StaffError("This person already has staff access.");
      if (input.action !== "GRANT" && !isStaff)
        throw new StaffError("This account does not have staff access.");
      const nextRole =
        input.action === "GRANT" || input.action === "SET_ROLE"
          ? input.role
          : input.action === "REVOKE"
            ? "CUSTOMER"
            : target.role;
      if (
        target.role === "ADMIN" &&
        nextRole !== "ADMIN" &&
        (await tx.user.count({ where: { role: "ADMIN" } })) <= 1
      )
        throw new StaffError("Keep at least one system administrator.");
      if (
        input.action === "GRANT" &&
        !target.accounts.some((a) => a.providerId === "credential")
      )
        throw new StaffError(
          "Staff need an email-and-password login for two-step sign-in. Ask the person to create an account with email instead of Google or Facebook.",
        );
      if (nextRole !== target.role)
        await tx.user.update({
          where: { id: target.id },
          data: { role: nextRole },
        });
      if (input.action === "RESET_MFA") {
        await tx.twoFactor.deleteMany({ where: { userId: target.id } });
        await tx.user.update({
          where: { id: target.id },
          data: { twoFactorEnabled: false },
        });
      }
      // Any access change takes effect at once: existing sessions end.
      await tx.session.deleteMany({ where: { userId: target.id } });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: `STAFF_${input.action}`,
          entityId: target.id,
          detail:
            nextRole !== target.role
              ? `${target.email}: ${target.role} → ${nextRole}`
              : target.email,
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof StaffError
            ? e.message
            : "Could not update staff access. Please try again.",
      },
      { status: 409 },
    );
  }
}
