import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { deliverQueued, queueReminders } from "@/lib/notify";
import { db } from "@/lib/db";
import { removeAbandonedPhotos } from "@/lib/photos";
import { refreshPendingRefunds } from "@/lib/refunds";
// Run every 10–15 minutes from a scheduler (for example Vercel Cron) with
// "Authorization: Bearer <CRON_SECRET>". Queues pickup and return reminders,
// then sends or retries everything that is due. Also removes inspection photos
// that were uploaded but never saved with an inspection, and asks the payment
// providers for the status of refunds still in progress.
export const dynamic = "force-dynamic";
export const maxDuration = 60;
function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
export async function GET(req: Request) {
  if (!authorised(req))
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const queued = await queueReminders();
  const delivery = await deliverQueued(100);
  const abandonedPhotos = await removeAbandonedPhotos(db);
  const refundsChecked = await refreshPendingRefunds();
  return NextResponse.json(
    { queued, ...delivery, abandonedPhotos, refundsChecked },
    { headers: { "Cache-Control": "no-store" } },
  );
}
