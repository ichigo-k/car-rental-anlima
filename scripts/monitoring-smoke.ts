import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
// Error grouping, alert de-duplication and the health check against the real
// database. Provider keys are blanked so nothing is sent; everything created
// here is removed afterwards.
for (const key of [
  "RESEND_API_KEY",
  "SMSONLINEGH_API_KEY",
  "TRACKSOLID_APP_KEY",
  "TRACKSOLID_APP_SECRET",
])
  process.env[key] = "";
const opsEmail = `ops-${randomBytes(4).toString("hex")}@example.com`;
process.env.OPERATIONS_EMAIL = opsEmail;
const db = new PrismaClient();
const started = new Date();
const marker = `Monitoring test ${randomBytes(4).toString("hex")}`;
async function main() {
  const { recordError, checkOperations, healthChecks, HEARTBEAT } =
    await import("../src/lib/monitoring");
  const request = { path: "/reset-password?token=secret-token", method: "GET" };
  const context = { routePath: "/reset-password", routeType: "render" };
  await recordError(db, new Error(marker), request, context);
  await recordError(db, new Error(marker), request, context);
  const events = await db.errorEvent.findMany({ where: { message: marker } });
  assert.equal(events.length, 1, "the same error is grouped");
  assert.equal(events[0].count, 2);
  assert.equal(events[0].path, "/reset-password", "query strings are not kept");
  const errorAlerts = await db.notification.count({
    where: {
      recipient: opsEmail,
      template: "OPS_ALERT",
      body: { contains: marker },
    },
  });
  assert.equal(errorAlerts, 1, "one alert per error per hour");

  const first = await checkOperations(db);
  const alertsAfterFirst = await db.notification.count({
    where: {
      recipient: opsEmail,
      subject: { not: { contains: "server error" } },
    },
  });
  assert.equal(alertsAfterFirst, first.length, "one alert per problem");
  await checkOperations(db);
  assert.equal(
    await db.notification.count({
      where: {
        recipient: opsEmail,
        subject: { not: { contains: "server error" } },
      },
    }),
    alertsAfterFirst,
    "a problem is not alerted again within six hours",
  );
  const beat = await db.integrationState.findUniqueOrThrow({
    where: { key: HEARTBEAT },
  });
  assert.ok(
    new Date(beat.value) >= started,
    "the scheduled job records that it ran",
  );

  const health = await healthChecks(db);
  assert.equal(health.checks.database, "ok");
  assert.equal(health.checks.storage, "ok");
  assert.equal(health.checks.scheduler, "ok");
  console.log(
    `PASS: error grouping without query strings, one alert per error per hour, one alert per problem with six-hour repeat (${first.length} current problem${first.length === 1 ? "" : "s"}: ${first.map((p) => p.key).join(", ") || "none"}), scheduler heartbeat and health checks. Nothing was sent.`,
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.errorEvent.deleteMany({ where: { message: marker } });
    await db.notification.deleteMany({ where: { recipient: opsEmail } });
    // Remove the alert markers this run set, so real alerts are not held back.
    await db.integrationState.deleteMany({
      where: { key: { startsWith: "alert:" }, updatedAt: { gte: started } },
    });
    await db.$disconnect();
  });
