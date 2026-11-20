import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { GpsPosition } from "../src/lib/gps";
// Geofence crossings and alerts against the real database, with positions
// supplied by the test. Email keys are blanked so nothing is sent; everything
// created here is removed afterwards.
process.env.RESEND_API_KEY = "";
const opsEmail = `ops-geo-${randomBytes(4).toString("hex")}@example.com`;
process.env.OPERATIONS_EMAIL = opsEmail;
const db = new PrismaClient();
const tag = randomBytes(4).toString("hex");
const ids: { vehicle?: string; fences: string[] } = { fences: [] };
const at = (lat: number, lng: number): GpsPosition => ({
  vehicleId: ids.vehicle!,
  latitude: lat,
  longitude: lng,
  recordedAt: new Date().toISOString(),
  heartbeatAt: null,
  speedKmh: 40,
  heading: 0,
  ignitionOn: true,
  freshness: "LIVE",
});
async function main() {
  const { evaluateGeofences } = await import("../src/lib/geofences");
  ids.vehicle = (
    await db.vehicle.create({
      data: {
        slug: `geofence-test-${tag}`,
        name: `Geofence Test Car ${tag}`,
        category: "Saloon",
        seats: 5,
        dailyRate: 90000,
        deposit: 400000,
        image: "/images/vehicle-photo-coming-soon.svg",
        description: "Temporary car for geofence tests.",
        status: "INACTIVE",
      },
    })
  ).id;
  const fence = await db.geofence.create({
    data: {
      name: `Accra ${tag}`,
      kind: "ALLOWED",
      shape: "CIRCLE",
      centerLat: 5.6037,
      centerLng: -0.187,
      radiusM: 20000,
      vehicleIds: [ids.vehicle],
      createdBy: "TEST",
    },
  });
  const rentalsOnly = await db.geofence.create({
    data: {
      name: `Rentals only ${tag}`,
      kind: "ALLOWED",
      shape: "CIRCLE",
      centerLat: 5.6037,
      centerLng: -0.187,
      radiusM: 20000,
      vehicleIds: [ids.vehicle],
      appliesWhen: "ON_RENTAL",
      createdBy: "TEST",
    },
  });
  ids.fences.push(fence.id, rentalsOnly.id);
  const events = () =>
    db.geofenceEvent.findMany({
      where: { geofenceId: { in: ids.fences } },
      orderBy: { createdAt: "asc" },
    });
  const alerts = () =>
    db.notification.count({
      where: { recipient: opsEmail, template: "OPS_ALERT" },
    });

  await evaluateGeofences(db, [at(5.6, -0.2)]);
  assert.equal(
    (await events()).length,
    0,
    "a car inside a new area raises nothing",
  );
  // Two checks at once (scheduled job and an open map) record it once.
  await Promise.all([
    evaluateGeofences(db, [at(5.1, -1.25)]),
    evaluateGeofences(db, [at(5.1, -1.25)]),
  ]);
  let list = await events();
  assert.deepEqual(
    list.map((e) => [e.geofenceId, e.type]),
    [[fence.id, "EXIT"]],
  );
  assert.equal(
    await alerts(),
    1,
    "leaving the area emails the operations inbox",
  );
  await evaluateGeofences(db, [at(5.11, -1.26)]);
  assert.equal(
    (await events()).length,
    1,
    "staying outside raises no new alert",
  );
  await evaluateGeofences(db, [at(5.6, -0.2)]);
  list = await events();
  assert.equal(list.at(-1)?.type, "ENTER", "coming back is recorded");
  assert.equal(await alerts(), 1, "coming back is not alerted");
  assert.equal(
    await db.geofenceState.count({ where: { geofenceId: rentalsOnly.id } }),
    0,
    "a rentals-only area ignores a parked car",
  );
  console.log(
    "PASS: no alert for cars already inside a new area, one event and one alert when a car leaves (even with two checks at once), no repeat while outside, return recorded without an alert, rentals-only areas ignore parked cars. Nothing was sent.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.notification.deleteMany({ where: { recipient: opsEmail } });
    const events = await db.geofenceEvent.findMany({
      where: { geofenceId: { in: ids.fences } },
      select: { id: true },
    });
    await db.integrationState.deleteMany({
      where: { key: { in: events.map((e) => `alert:geofence:${e.id}`) } },
    });
    await db.geofence.deleteMany({ where: { id: { in: ids.fences } } });
    if (ids.vehicle) await db.vehicle.delete({ where: { id: ids.vehicle } });
    await db.$disconnect();
  });
