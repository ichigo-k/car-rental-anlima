import { NextResponse } from "next/server";
import { session } from "@/lib/auth";
import { accountDestination, safeAuthRedirect } from "@/lib/auth-redirect";
export async function GET(req: Request) {
  const next = safeAuthRedirect(new URL(req.url).searchParams.get("next"));
  const current = await session();
  const destination = current
    ? accountDestination(current.user.role, next)
    : `/sign-in?next=${encodeURIComponent(next)}`;
  // Behind the proxy req.url is the app's internal address (127.0.0.1:3100),
  // so redirect on the public one.
  return NextResponse.redirect(
    new URL(destination, process.env.BETTER_AUTH_URL),
    {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
