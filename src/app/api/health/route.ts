import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { healthChecks } from "@/lib/monitoring";
// For uptime monitors. "ok" when everything works, "degraded" when the site
// works but something needs a look (scheduled job late, no recent backup),
// 503 "down" when the database or photo storage is unusable. No details are
// public; staff see them at /admin/system.
export const dynamic = "force-dynamic";
export async function GET() {
  const health = await healthChecks(db);
  return NextResponse.json(health, {
    status: health.status === "down" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
