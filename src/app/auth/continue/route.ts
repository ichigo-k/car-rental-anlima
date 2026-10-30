import { NextResponse } from "next/server";
import { session } from "@/lib/auth";
import { accountDestination, safeAuthRedirect } from "@/lib/auth-redirect";
export async function GET(req: Request) {
  const next = safeAuthRedirect(new URL(req.url).searchParams.get("next"));
  const current = await session();
  const destination = current
    ? accountDestination(current.user.role, next)
    : `/sign-in?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(new URL(destination, req.url), {
    status: 307,
    headers: { "Cache-Control": "private, no-store" },
  });
}
