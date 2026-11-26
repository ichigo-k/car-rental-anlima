import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  BACKUP,
  RESTORE_TEST,
  cronAuthorised,
  saveReport,
} from "@/lib/monitoring";
// The backup and restore-test scripts on the server report their result here
// with "Authorization: Bearer <CRON_SECRET>".
const schema = z.object({
  kind: z.enum(["backup", "restore-test"]),
  ok: z.boolean(),
  detail: z.string().max(500),
});
export async function POST(req: Request) {
  if (!cronAuthorised(req))
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  const { kind, ok, detail } = parsed.data;
  await saveReport(db, kind === "backup" ? BACKUP : RESTORE_TEST, {
    at: new Date().toISOString(),
    ok,
    detail,
  });
  await db.auditEvent.create({
    data: {
      actorId: "SYSTEM",
      action: kind === "backup" ? "BACKUP_REPORTED" : "RESTORE_TEST_REPORTED",
      entityId: kind,
      detail: `${ok ? "OK" : "FAILED"}: ${detail}`,
    },
  });
  return NextResponse.json({ ok: true });
}
