import type { Prisma, PrismaClient } from "@prisma/client";
import { after } from "next/server";
import { db } from "../db";
import {
  emailHtml,
  message,
  smsNumber,
  type Audience,
  type Template,
} from "./templates";
import { NotConfigured, ProviderError, sendEmail, sendSms } from "./providers";

type Writer = PrismaClient | Prisma.TransactionClient;
const CUSTOMER_SMS: Template[] = [
  "BOOKING_CONFIRMED",
  "PAYMENT_REVIEW",
  "BOOKING_CANCELLED",
  "BOOKING_CHANGED",
  "PICKUP_REMINDER",
  "RETURN_REMINDER",
  "RETURN_OVERDUE",
];
export const MAX_ATTEMPTS = 5;

// Queues a booking's messages in the caller's transaction. The dedupe key
// makes each (template, booking, audience, channel) message unique, so
// retries and repeated reminder runs never send it twice. Events that can
// happen more than once per booking pass their own key.
export async function queueBookingMessages(
  tx: Writer,
  bookingId: string,
  template: Template,
  audiences: Audience[] = ["customer", "operations"],
  key?: string,
) {
  const b = await tx.booking.findUnique({
    where: { id: bookingId },
    include: { vehicle: true, user: { select: { email: true } } },
  });
  if (!b) return 0;
  const rows: Prisma.NotificationCreateManyInput[] = [];
  const add = (
    audience: Audience,
    channel: "EMAIL" | "SMS",
    recipient: string | null | undefined,
  ) => {
    const m = message(template, audience, b);
    if (!m || !recipient) return;
    rows.push({
      dedupeKey: `${template}:${b.id}:${key ? `${key}:` : ""}${audience}:${channel}`,
      bookingId: b.id,
      template,
      channel,
      recipient,
      subject: channel === "EMAIL" ? m.subject : null,
      body: channel === "EMAIL" ? m.text : m.sms,
    });
  };
  if (audiences.includes("customer")) {
    add("customer", "EMAIL", b.customerEmail ?? b.user.email);
    if (CUSTOMER_SMS.includes(template))
      add("customer", "SMS", smsNumber(b.phone));
  }
  if (audiences.includes("operations"))
    add("operations", "EMAIL", process.env.OPERATIONS_EMAIL);
  if (!rows.length) return 0;
  const created = await tx.notification.createMany({
    data: rows,
    skipDuplicates: true,
  });
  return created.count;
}

// Sign-in messages (verification links, codes, password resets) are not
// tied to a booking. They expire if they cannot be sent within 30 minutes,
// and their content is wiped once sent or expired so staff never see it.
export const AUTH_TEMPLATES = [
  "AUTH_VERIFY_EMAIL",
  "AUTH_RESET_PASSWORD",
  "AUTH_PHONE_CODE",
  "AUTH_PHONE_RESET_CODE",
] as const;
const AUTH_EXPIRY_MINUTES = 30;
const REDACTED = "[removed after sending]";
export async function queueAuthMessage(input: {
  template: (typeof AUTH_TEMPLATES)[number];
  channel: "EMAIL" | "SMS";
  recipient: string;
  subject?: string;
  body: string;
}) {
  const n = await db.notification.create({
    data: {
      ...input,
      subject: input.subject ?? null,
      dedupeKey: `${input.template}:${crypto.randomUUID()}`,
    },
  });
  deliverSoon();
  return n.id;
}
const isAuth = (template: string) => template.startsWith("AUTH_");

// Sends due messages. Each row is leased for five minutes before sending so
// two workers never send the same message.
export async function deliverQueued(limit = 25, ids?: string[]) {
  const now = new Date();
  const due = await db.notification.findMany({
    where: {
      status: "QUEUED",
      nextAttemptAt: { lte: now },
      ...(ids ? { id: { in: ids } } : {}),
    },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  });
  let sent = 0;
  for (const n of due) {
    const lease = await db.notification.updateMany({
      where: { id: n.id, status: "QUEUED", nextAttemptAt: n.nextAttemptAt },
      data: { nextAttemptAt: new Date(Date.now() + 5 * 60000) },
    });
    if (lease.count !== 1) continue;
    if (
      isAuth(n.template) &&
      n.createdAt.getTime() < Date.now() - AUTH_EXPIRY_MINUTES * 60000
    ) {
      await db.notification.update({
        where: { id: n.id },
        data: {
          status: "FAILED",
          body: REDACTED,
          lastError: "Expired before it could be sent",
        },
      });
      continue;
    }
    try {
      const providerId =
        n.channel === "EMAIL"
          ? await sendEmail({
              to: n.recipient,
              subject: n.subject ?? "ANLIMA Car Rental",
              text: n.body,
              html: emailHtml(n.body),
              idempotencyKey: n.id,
            })
          : await sendSms({ to: n.recipient, text: n.body });
      await db.notification.update({
        where: { id: n.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerId,
          lastError: null,
          attempts: { increment: 1 },
          ...(isAuth(n.template) ? { body: REDACTED } : {}),
        },
      });
      sent += 1;
    } catch (error) {
      // Missing keys are not a delivery attempt: wait and check again.
      if (error instanceof NotConfigured) {
        await db.notification.update({
          where: { id: n.id },
          data: {
            lastError: error.message,
            nextAttemptAt: new Date(Date.now() + 15 * 60000),
          },
        });
        continue;
      }
      const attempts = n.attempts + 1;
      const permanent = error instanceof ProviderError && error.permanent;
      await db.notification.update({
        where: { id: n.id },
        data: {
          attempts,
          lastError: (error as Error).message.slice(0, 500),
          status: permanent || attempts >= MAX_ATTEMPTS ? "FAILED" : "QUEUED",
          ...(isAuth(n.template) && (permanent || attempts >= MAX_ATTEMPTS)
            ? { body: REDACTED }
            : {}),
          nextAttemptAt: new Date(Date.now() + 2 ** attempts * 60000),
        },
      });
    }
  }
  return { due: due.length, sent };
}

// Sends after the current response has finished, so a slow or failing
// provider never delays or undoes the request. Outside a request (scripts)
// the scheduled sweep delivers instead.
export function deliverSoon() {
  try {
    after(() => deliverQueued().catch(() => undefined));
  } catch {
    // Not inside a request.
  }
}

// Reminders for the guide's upcoming pickup, upcoming return and overdue
// return notifications. Safe to run as often as needed.
export async function queueReminders(now = new Date()) {
  const hour = 3600000;
  const [pickups, returns, overdue] = await Promise.all([
    db.booking.findMany({
      where: {
        status: "CONFIRMED",
        pickup: { gt: now, lte: new Date(now.getTime() + 24 * hour) },
      },
      select: { id: true },
    }),
    db.booking.findMany({
      where: {
        status: "CHECKED_OUT",
        returnAt: { gt: now, lte: new Date(now.getTime() + 3 * hour) },
      },
      select: { id: true },
    }),
    db.booking.findMany({
      where: {
        status: "CHECKED_OUT",
        returnAt: { lte: new Date(now.getTime() - hour) },
      },
      select: { id: true },
    }),
  ]);
  let queued = 0;
  for (const b of pickups)
    queued += await queueBookingMessages(db, b.id, "PICKUP_REMINDER", [
      "customer",
    ]);
  for (const b of returns)
    queued += await queueBookingMessages(db, b.id, "RETURN_REMINDER", [
      "customer",
    ]);
  for (const b of overdue)
    queued += await queueBookingMessages(db, b.id, "RETURN_OVERDUE");
  return queued;
}
