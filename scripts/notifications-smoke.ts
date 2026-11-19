import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { PrismaClient } from "@prisma/client";
// Exercises the notification outbox against local stand-ins for Resend and
// SMSOnlineGH. Only this script's own messages are delivered; nothing reaches
// the real providers.
const db = new PrismaClient();
const suffix = randomBytes(5).toString("hex");
type Hit = { path: string; headers: IncomingMessage["headers"]; body: any };
const hits: Hit[] = [];
let smsFailuresLeft = 0;
const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw || "{}");
    hits.push({ path: req.url ?? "", headers: req.headers, body });
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/emails")
      return res.end(JSON.stringify({ id: `email-${hits.length}` }));
    if (req.url === "/v5/message/sms/send") {
      if (smsFailuresLeft > 0) {
        smsFailuresLeft -= 1;
        return res.end(
          JSON.stringify({
            handshake: { id: 1408, label: "HSHK_ERR" },
            data: {},
          }),
        );
      }
      return res.end(
        JSON.stringify({
          handshake: { id: 0, label: "HSHK_OK" },
          data: {
            batch: "b1",
            destinations: [
              { id: "sms-1", to: body.destinations[0], status: { id: 2105 } },
            ],
          },
        }),
      );
    }
    res.statusCode = 404;
    res.end("{}");
  });
});
let userId = "";
let vehicleId = "";
const authIds: string[] = [];
async function main() {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const key of [
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "SMSONLINEGH_API_KEY",
    "SMSONLINEGH_SENDER",
    "OPERATIONS_EMAIL",
  ])
    // Blank rather than delete: loading .env never overwrites a variable that
    // exists, so real keys in .env cannot come back.
    process.env[key] = "";
  process.env.RESEND_BASE_URL = base;
  process.env.SMSONLINEGH_BASE_URL = base;
  const { queueBookingMessages, deliverQueued, queueAuthMessage } =
    await import("../src/lib/notify");
  const user = await db.user.create({
    data: {
      id: `notify-${suffix}`,
      name: "Notify Test",
      email: `notify-${suffix}@example.com`,
    },
  });
  userId = user.id;
  const car = await db.vehicle.create({
    data: {
      slug: `notify-${suffix}`,
      name: "Temporary test vehicle",
      category: "Test",
      seats: 5,
      dailyRate: 75000,
      image: "/images/anlima-hero.png",
      description: "Temporary notification fixture",
    },
  });
  vehicleId = car.id;
  const pickup = new Date(Date.now() + 86400000);
  const booking = await db.booking.create({
    data: {
      reference: `AN-N${suffix.toUpperCase()}`,
      userId,
      vehicleId,
      pickup,
      returnAt: new Date(pickup.getTime() + 86400000),
      location: "Accra · Airport pickup",
      phone: "024 123 4567",
      customerName: "Ama Mensah",
      customerEmail: user.email,
      licenceNumber: "TEST",
      licenceExpiry: new Date("2030-01-01"),
      status: "CONFIRMED",
      days: 1,
      dailyRate: 75000,
      rentalAmount: 75000,
      deposit: 150000,
      total: 225000,
      termsVersion: "test",
      termsAcceptedAt: new Date(),
      holdExpiresAt: new Date(),
    },
  });
  process.env.OPERATIONS_EMAIL = "ops@example.com";
  assert.equal(
    await queueBookingMessages(db, booking.id, "BOOKING_CONFIRMED"),
    3,
    "customer email, customer SMS and operations email",
  );
  assert.equal(
    await queueBookingMessages(db, booking.id, "BOOKING_CONFIRMED"),
    0,
    "the same event is never queued twice",
  );
  const ids = async () =>
    (
      await db.notification.findMany({
        where: { bookingId: booking.id },
        select: { id: true },
      })
    ).map((n) => n.id);
  // Without keys, messages wait and no attempt is used.
  await deliverQueued(10, await ids());
  let rows = await db.notification.findMany({
    where: { bookingId: booking.id },
  });
  assert.ok(rows.every((n) => n.status === "QUEUED" && n.attempts === 0));
  assert.match(rows[0].lastError ?? "", /not configured/);
  assert.equal(hits.length, 0);
  // Connect the providers; SMS fails once, then succeeds on retry.
  Object.assign(process.env, {
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "ANLIMA <bookings@example.com>",
    SMSONLINEGH_API_KEY: "sms_test",
    SMSONLINEGH_SENDER: "ANLIMA",
  });
  smsFailuresLeft = 1;
  await db.notification.updateMany({
    where: { bookingId: booking.id },
    data: { nextAttemptAt: new Date() },
  });
  await deliverQueued(10, await ids());
  rows = await db.notification.findMany({ where: { bookingId: booking.id } });
  const email = rows.find(
    (n) => n.channel === "EMAIL" && n.recipient === user.email,
  )!;
  const sms = rows.find((n) => n.channel === "SMS")!;
  assert.equal(email.status, "SENT");
  assert.equal(sms.status, "QUEUED", "a failed SMS is retried later");
  assert.equal(sms.attempts, 1);
  assert.match(sms.lastError ?? "", /HSHK_ERR/);
  const emailHit = hits.find(
    (h) => h.path === "/emails" && h.body.to[0] === user.email,
  )!;
  assert.equal(emailHit.headers.authorization, "Bearer re_test");
  assert.equal(emailHit.headers["idempotency-key"], email.id);
  assert.match(emailHit.body.subject, /is confirmed/);
  assert.ok(!emailHit.body.html.includes("<script"));
  await db.notification.update({
    where: { id: sms.id },
    data: { nextAttemptAt: new Date() },
  });
  await deliverQueued(10, [sms.id]);
  const smsHit = hits.filter((h) => h.path === "/v5/message/sms/send").at(-1)!;
  assert.equal(smsHit.headers.authorization, "key sms_test");
  assert.deepEqual(smsHit.body.destinations, ["233241234567"]);
  assert.equal(smsHit.body.sender, "ANLIMA");
  assert.equal(smsHit.body.type, 0);
  const sent = await db.notification.findUniqueOrThrow({
    where: { id: sms.id },
  });
  assert.equal(sent.status, "SENT");
  assert.equal(sent.providerId, "sms-1");
  // Repeated failures end in FAILED for staff to resend.
  await db.notification.update({
    where: { id: sms.id },
    data: { status: "QUEUED", attempts: 4, nextAttemptAt: new Date() },
  });
  smsFailuresLeft = 1;
  await deliverQueued(10, [sms.id]);
  assert.equal(
    (await db.notification.findUniqueOrThrow({ where: { id: sms.id } })).status,
    "FAILED",
  );
  // Codes and reset links are wiped once sent, and expire unsent.
  const codeId = await queueAuthMessage({
    template: "AUTH_PHONE_CODE",
    channel: "SMS",
    recipient: "233200000001",
    body: "ANLIMA: your verification code is 123456.",
  });
  const staleId = await queueAuthMessage({
    template: "AUTH_RESET_PASSWORD",
    channel: "EMAIL",
    recipient: `notify-${suffix}@example.com`,
    subject: "Reset",
    body: "https://example.com/reset?token=secret",
  });
  authIds.push(codeId, staleId);
  await db.notification.update({
    where: { id: staleId },
    data: { createdAt: new Date(Date.now() - 31 * 60000) },
  });
  await deliverQueued(10, [codeId, staleId]);
  const code = await db.notification.findUniqueOrThrow({
    where: { id: codeId },
  });
  assert.equal(code.status, "SENT");
  assert.ok(!code.body.includes("123456"), "sent codes are wiped");
  const stale = await db.notification.findUniqueOrThrow({
    where: { id: staleId },
  });
  assert.equal(stale.status, "FAILED");
  assert.ok(!stale.body.includes("token"), "expired links are wiped");
  assert.ok(
    !hits.some((h) => JSON.stringify(h.body).includes("token=secret")),
    "an expired reset link is never sent",
  );
  console.log(
    "PASS: outbox queuing and de-duplication, waiting without keys, Resend and SMSOnlineGH request format, Ghana number formatting, idempotency key, retry with backoff, failure after 5 attempts, and wiping and expiry of sign-in codes and links. Nothing reached the real providers.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (vehicleId) {
      await db.notification.deleteMany({
        where: { booking: { vehicleId } },
      });
      await db.booking.deleteMany({ where: { vehicleId } });
      await db.vehicle.delete({ where: { id: vehicleId } });
    }
    await db.notification.deleteMany({ where: { id: { in: authIds } } });
    if (userId) await db.user.delete({ where: { id: userId } });
    server.close();
    await db.$disconnect();
  });
