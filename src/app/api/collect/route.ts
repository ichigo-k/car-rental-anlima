import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trustedOrigin } from "@/lib/request";
import { siteUrl } from "@/lib/seo";
import { cleanEvent, recordEvent } from "@/lib/site-analytics";
// Receives page views and booking-funnel events from the website's own pages.
// Only the live site records them: the development app shares the live
// database and must not add to its figures.
export async function POST(req: Request) {
  const ok = new NextResponse(null, { status: 204 });
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ANALYTICS_IN_DEV !== "1"
  )
    return ok;
  if (!trustedOrigin(req)) return ok;
  const text = await req.text().catch(() => "");
  if (text.length > 2000) return ok;
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return ok;
  }
  const event = cleanEvent(body, siteUrl().hostname);
  if (!event) return ok;
  const ip =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "";
  await recordEvent(
    db,
    {
      ip,
      userAgent: req.headers.get("user-agent") ?? "",
      doNotTrack:
        req.headers.get("dnt") === "1" || req.headers.get("sec-gpc") === "1",
    },
    event,
  ).catch(() => false);
  return ok;
}
