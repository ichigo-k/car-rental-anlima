import { NextResponse } from "next/server";
import { deliverQueued, queueReminders } from "@/lib/notify";
import { db } from "@/lib/db";
import { removeAbandonedPhotos } from "@/lib/photos";
import { refreshPendingRefunds } from "@/lib/refunds";
import { checkOperations, cronAuthorised } from "@/lib/monitoring";
// Run every 10–15 minutes from a scheduler (for example Vercel Cron) with
// "Authorization: Bearer <CRON_SECRET>". Queues pickup and return reminders,
// then sends or retries everything that is due. Also removes inspection photos
// that were uploaded but never saved with an inspection, and asks the payment
// providers for the status of refunds still in progress. Finally records that
// it ran and emails the operations inbox about anything that needs attention.
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: Request) {
  if (!cronAuthorised(req))
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const queued = await queueReminders();
  const delivery = await deliverQueued(100);
  const abandonedPhotos = await removeAbandonedPhotos(db);
  const refundsChecked = await refreshPendingRefunds();
  const problems = await checkOperations(db);
  return NextResponse.json(
    {
      queued,
      ...delivery,
      abandonedPhotos,
      refundsChecked,
      problems: problems.map((p) => p.key),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
