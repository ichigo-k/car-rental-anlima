import { createHash, timingSafeEqual } from "node:crypto";
import { access, constants, mkdir } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { deliverSoon } from "./notify";
import { fleetPositions } from "./gps";
import { tracksolidConfig } from "./tracksolid";

// Monitoring and alerts (Guide FR-023): grouped server errors, a health check
// for uptime monitors, and a scheduled check that emails the operations inbox
// (OPERATIONS_EMAIL) when something needs attention. Each alert repeats at
// most every few hours while the problem lasts.
export const HEARTBEAT = "monitor.cron";
export const BACKUP = "monitor.backup";
export const RESTORE_TEST = "monitor.restoreTest";
const HOUR = 3600000;
const SCHEDULER_LATE_MIN = 30;
const BACKUP_LATE_HOURS = 26;

// Bearer CRON_SECRET, compared in constant time; for the scheduled job and
// the backup scripts on the server.
export function cronAuthorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Query strings can carry tokens (password reset links), so they are dropped.
export const cleanPath = (p: string) => p.split(/[?#]/)[0].slice(0, 300);
export function errorFingerprint(message: string, route: string) {
  return createHash("sha256")
    .update(`${message.split("\n")[0]}|${route}`)
    .digest("hex")
    .slice(0, 32);
}

// Emails the operations inbox; repeats for the same key at most once per
// repeatAfterMs. Returns whether an email was queued.
export async function opsAlert(
  db: PrismaClient,
  key: string,
  subject: string,
  body: string,
  now: Date,
  repeatAfterMs: number,
) {
  const to = process.env.OPERATIONS_EMAIL;
  if (!to) return false;
  const stateKey = `alert:${key}`;
  const last = await db.integrationState.findUnique({
    where: { key: stateKey },
  });
  if (last?.expiresAt && last.expiresAt > now) return false;
  const expiresAt = new Date(now.getTime() + repeatAfterMs);
  await db.integrationState.upsert({
    where: { key: stateKey },
    create: { key: stateKey, value: now.toISOString(), expiresAt },
    update: { value: now.toISOString(), expiresAt },
  });
  await db.notification.create({
    data: {
      template: "OPS_ALERT",
      channel: "EMAIL",
      recipient: to,
      subject: `ANLIMA alert: ${subject}`,
      body: `${body}\n\nSee ${process.env.BETTER_AUTH_URL ?? ""}/admin/system for details.`,
      dedupeKey: `OPS_ALERT:${key}:${now.getTime()}`,
    },
  });
  deliverSoon();
  return true;
}

// Called by src/instrumentation.ts for every server error. Never throws.
export async function recordError(
  db: PrismaClient,
  error: unknown,
  request: { path: string; method: string },
  context?: { routePath?: string; routeType?: string },
  now = new Date(),
) {
  try {
    const message =
      (error instanceof Error ? error.message : String(error)).slice(0, 1000) ||
      "Unknown error";
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest: unknown }).digest).slice(0, 100)
        : null;
    const route = context?.routePath || cleanPath(request.path);
    const fingerprint = errorFingerprint(message, route);
    const event = await db.errorEvent.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        message,
        digest,
        path: cleanPath(request.path),
        method: request.method.slice(0, 10),
        routeType: context?.routeType ?? null,
        firstSeen: now,
        lastSeen: now,
      },
      update: { count: { increment: 1 }, lastSeen: now, digest },
    });
    if (event.alertedAt && now.getTime() - event.alertedAt.getTime() < HOUR)
      return;
    const sent = await opsAlert(
      db,
      `error:${fingerprint}`,
      `server error on ${route}`,
      `A server error happened on ${request.method} ${cleanPath(request.path)} (${event.count} time${event.count === 1 ? "" : "s"} so far).\n\n${message.split("\n")[0]}`,
      now,
      HOUR,
    );
    if (sent)
      await db.errorEvent.update({
        where: { id: event.id },
        data: { alertedAt: now },
      });
  } catch {
    // Monitoring must never break a request.
  }
}

type Report = { at: string; ok: boolean; detail: string };
const readReport = async (db: PrismaClient, key: string) => {
  const row = await db.integrationState.findUnique({ where: { key } });
  try {
    return row ? (JSON.parse(row.value) as Report) : null;
  } catch {
    return null;
  }
};
export async function saveReport(
  db: PrismaClient,
  key: typeof BACKUP | typeof RESTORE_TEST,
  report: Report,
) {
  await db.integrationState.upsert({
    where: { key },
    create: { key, value: JSON.stringify(report) },
    update: { value: JSON.stringify(report) },
  });
}

export type OpsState = {
  failedMessages: number;
  stuckMessages: number;
  messagingConfigured: boolean;
  unknownRefunds: number;
  slowRefunds: number;
  paymentReviews: number;
  backup: Report | null;
  gpsError: string | null;
};
export type Problem = { key: string; title: string; detail: string };

// What needs attention, from the gathered state. Pure, for testing.
export function problemsFrom(s: OpsState, now = new Date()): Problem[] {
  const problems: Problem[] = [];
  const n = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;
  if (s.failedMessages)
    problems.push({
      key: "messages-failed",
      title: "Messages could not be sent",
      detail: `${n(s.failedMessages, "email or text", "emails or texts")} failed in the last 24 hours. Check Notifications and the provider keys.`,
    });
  if (s.stuckMessages)
    problems.push({
      key: "messages-stuck",
      title: "Messages are waiting to be sent",
      detail: `${n(s.stuckMessages, "message has", "messages have")} been waiting more than 30 minutes.${s.messagingConfigured ? "" : " Email or SMS keys are not set."}`,
    });
  if (s.unknownRefunds)
    problems.push({
      key: "refunds-unknown",
      title: "Refunds need checking",
      detail: `${n(s.unknownRefunds, "refund's", "refunds'")} outcome was lost. Check the provider's dashboard and record what you find on the Payments page.`,
    });
  if (s.slowRefunds)
    problems.push({
      key: "refunds-slow",
      title: "Refunds are taking long",
      detail: `${n(s.slowRefunds, "refund has", "refunds have")} been in progress for more than 15 days.`,
    });
  if (s.paymentReviews)
    problems.push({
      key: "payment-review",
      title: "Payments need review",
      detail: `${n(s.paymentReviews, "paid booking needs", "paid bookings need")} staff review before pickup.`,
    });
  if (s.backup && !s.backup.ok)
    problems.push({
      key: "backup-failed",
      title: "The last backup failed",
      detail: s.backup.detail,
    });
  else if (
    s.backup &&
    now.getTime() - new Date(s.backup.at).getTime() > BACKUP_LATE_HOURS * HOUR
  )
    problems.push({
      key: "backup-late",
      title: "No recent backup",
      detail: `The last backup finished ${new Date(s.backup.at).toISOString()}.`,
    });
  if (s.gpsError)
    problems.push({
      key: "gps",
      title: "Fleet tracking is unavailable",
      detail: s.gpsError,
    });
  return problems;
}

export async function gatherState(
  db: PrismaClient,
  now = new Date(),
): Promise<OpsState> {
  const [
    failedMessages,
    stuckMessages,
    unknownRefunds,
    slowRefunds,
    paymentReviews,
    backup,
    linked,
  ] = await Promise.all([
    db.notification.count({
      where: {
        status: "FAILED",
        template: { not: "OPS_ALERT" },
        createdAt: { gt: new Date(now.getTime() - 24 * HOUR) },
        lastError: { not: "Expired before it could be sent" },
      },
    }),
    db.notification.count({
      where: {
        status: "QUEUED",
        createdAt: { lt: new Date(now.getTime() - 0.5 * HOUR) },
      },
    }),
    db.refund.count({ where: { status: "UNKNOWN" } }),
    db.refund.count({
      where: {
        status: "PENDING",
        createdAt: { lt: new Date(now.getTime() - 15 * 24 * HOUR) },
      },
    }),
    db.booking.count({ where: { status: "PAYMENT_REVIEW" } }),
    readReport(db, BACKUP),
    db.vehicle.findMany({
      where: { gpsImei: { not: null } },
      select: { id: true, gpsImei: true },
    }),
  ]);
  let gpsError: string | null = null;
  if (tracksolidConfig() && linked.length)
    gpsError = (await fleetPositions(linked)).error ?? null;
  return {
    failedMessages,
    stuckMessages,
    messagingConfigured: !!(
      process.env.RESEND_API_KEY &&
      process.env.EMAIL_FROM &&
      process.env.SMSONLINEGH_API_KEY
    ),
    unknownRefunds,
    slowRefunds,
    paymentReviews,
    backup,
    gpsError,
  };
}

// Run by the scheduled job: records that it ran, then emails new problems.
export async function checkOperations(db: PrismaClient, now = new Date()) {
  await db.integrationState.upsert({
    where: { key: HEARTBEAT },
    create: { key: HEARTBEAT, value: now.toISOString() },
    update: { value: now.toISOString() },
  });
  const problems = problemsFrom(await gatherState(db, now), now);
  for (const p of problems)
    await opsAlert(db, `ops:${p.key}`, p.title, p.detail, now, 6 * HOUR);
  return problems;
}

type Check = "ok" | "warn" | "fail";
// For uptime monitors: "ok", "degraded" (working, something needs a look) or
// "down" (the database or photo storage is unusable).
export async function healthChecks(db: PrismaClient, now = new Date()) {
  const checks: Record<
    "database" | "storage" | "scheduler" | "backups",
    Check
  > = {
    database: "ok",
    storage: "ok",
    scheduler: "ok",
    backups: "ok",
  };
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    checks.database = "fail";
  }
  try {
    const dir =
      process.env.UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads");
    await mkdir(dir, { recursive: true });
    await access(dir, constants.W_OK);
  } catch {
    checks.storage = "fail";
  }
  if (checks.database === "ok") {
    const beat = await db.integrationState.findUnique({
      where: { key: HEARTBEAT },
    });
    if (
      !beat ||
      now.getTime() - new Date(beat.value).getTime() >
        SCHEDULER_LATE_MIN * 60000
    )
      checks.scheduler = "warn";
    const backup = await readReport(db, BACKUP);
    if (
      !backup ||
      !backup.ok ||
      now.getTime() - new Date(backup.at).getTime() > BACKUP_LATE_HOURS * HOUR
    )
      checks.backups = "warn";
  } else {
    checks.scheduler = "warn";
    checks.backups = "warn";
  }
  const values = Object.values(checks);
  const status = values.includes("fail")
    ? "down"
    : values.includes("warn")
      ? "degraded"
      : "ok";
  return { status, checks };
}

export async function systemReports(db: PrismaClient) {
  const [heartbeat, backup, restoreTest] = await Promise.all([
    db.integrationState.findUnique({ where: { key: HEARTBEAT } }),
    readReport(db, BACKUP),
    readReport(db, RESTORE_TEST),
  ]);
  return { lastScheduledRun: heartbeat?.value ?? null, backup, restoreTest };
}
