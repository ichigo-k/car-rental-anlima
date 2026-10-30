import "dotenv/config";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const base = "http://localhost:3000";
const suffix = randomBytes(6).toString("hex");
let userId: string | undefined;
let vehicleId: string | undefined;
async function main() {
  const signup = await fetch(`${base}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({
      name: "Integration Test",
      email: `smoke-${suffix}@example.com`,
      password: randomBytes(24).toString("hex"),
      role: "ADMIN",
    }),
  });
  const account = await signup.json();
  assert.equal(signup.status, 200, JSON.stringify(account));
  userId = account.user.id;
  const cookie = signup.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  assert.ok(cookie);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  assert.equal(
    user.role,
    "CUSTOMER",
    "role injection must not grant staff access",
  );
  const car = await db.vehicle.create({
    data: {
      slug: `smoke-${suffix}`,
      name: "Temporary test vehicle",
      category: "Test",
      seats: 5,
      dailyRate: 75000,
      deposit: 150000,
      image: "/images/anlima-hero.png",
      description: "Temporary integration fixture",
    },
  });
  vehicleId = car.id;
  const pickup = new Date(Date.now() + 7 * 86400000),
    returnAt = new Date(pickup.getTime() + 2 * 86400000);
  const headers = {
    "Content-Type": "application/json",
    Origin: base,
    Cookie: cookie,
  };
  const body = JSON.stringify({
    vehicleId: car.id,
    pickup: pickup.toISOString(),
    returnAt: returnAt.toISOString(),
    location: "Accra · Airport pickup",
    phone: "0000000000",
    customerName: "Integration Test",
    customerEmail: account.user.email,
    ghanaCardNumber: "GHA-000000001-0",
    licenceNumber: "TEST-ONLY",
    licenceExpiry: "2030-01-01",
    terms: true,
  });
  const invalidPoint = await fetch(`${base}/api/bookings`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...JSON.parse(body),
      location: "Unconfigured pickup",
    }),
  });
  assert.equal(
    invalidPoint.status,
    409,
    "unconfigured pickup must be rejected",
  );
  const favourite = await fetch(`${base}/api/favourites`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ vehicleId: car.id }),
  });
  assert.equal(favourite.status, 200);
  const saved = await fetch(`${base}/api/favourites`, {
    headers: { Cookie: cookie },
  });
  assert.deepEqual((await saved.json()).vehicleIds, [car.id]);
  const anonymousSaved = await fetch(`${base}/api/favourites`);
  assert.deepEqual(
    (await anonymousSaved.json()).vehicleIds,
    [],
    "favourites must not leak to anonymous visitors",
  );
  const duplicateSave = await fetch(`${base}/api/favourites`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ vehicleId: car.id }),
  });
  assert.equal(duplicateSave.status, 200, "saving a favourite is idempotent");
  const attempts = await Promise.all([
    fetch(`${base}/api/bookings`, { method: "POST", headers, body }),
    fetch(`${base}/api/bookings`, { method: "POST", headers, body }),
  ]);
  assert.deepEqual(attempts.map((r) => r.status).sort(), [200, 409]);
  const created = await db.booking.findFirstOrThrow({
    where: { vehicleId: car.id },
  });
  assert.equal(created.total, 300000);
  assert.equal(created.status, "PENDING_PAYMENT");
  assert.ok(created.ghanaCardEncrypted?.startsWith("v1:"));
  assert.ok(!created.ghanaCardEncrypted?.includes("GHA-000000001-0"));
  assert.equal(created.ghanaCardLast4, "0010");
  assert.equal(created.customerEmail, account.user.email);
  assert.ok(created.holdExpiresAt.getTime() > Date.now() + 13 * 60000);
  const history = await fetch(`${base}/bookings`, {
    headers: { Cookie: cookie },
  });
  const historyHtml = await history.text();
  assert.ok(historyHtml.includes(created.reference));
  assert.ok(historyHtml.includes("Choose how to pay"));
  assert.ok(
    historyHtml.includes("Paystack") && historyHtml.includes("Flutterwave"),
  );
  const forgedReceipt = await fetch(
    `${base}/bookings?payment=verified&reference=${created.reference}`,
    { headers: { Cookie: cookie } },
  );
  assert(
    !(await forgedReceipt.text()).includes(
      "Payment verified. Your reservation status",
    ),
    "URL parameters must not claim an unpaid reservation was paid",
  );
  assert.ok(!historyHtml.includes("GHA-000000001-0"));
  assert.ok(
    !historyHtml.includes(created.ghanaCardEncrypted!),
    "identity ciphertext must not reach the browser",
  );
  const availability = await fetch(
    `${base}/api/availability?pickup=${encodeURIComponent(pickup.toISOString())}&returnAt=${encodeURIComponent(returnAt.toISOString())}`,
  );
  const eligible = await availability.json();
  assert.ok(
    !eligible.vehicles.some((v: { id: string }) => v.id === car.id),
    "active hold must block search",
  );
  const gps = await fetch(`${base}/api/admin/gps`, {
    headers: { Cookie: cookie },
  });
  assert.equal(gps.status, 403);
  const report = await fetch(`${base}/api/admin/reports`, {
    headers: { Cookie: cookie },
  });
  assert.equal(report.status, 403);
  const origin = await fetch(`${base}/api/bookings`, {
    method: "POST",
    headers: { ...headers, Origin: "https://untrusted.example" },
    body,
  });
  assert.equal(origin.status, 403);
  if (!process.env.PAYSTACK_SECRET_KEY) {
    const checkout = await fetch(`${base}/api/payments/checkout`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reference: created.reference }),
    });
    assert.equal(checkout.status, 503);
    assert.match((await checkout.json()).error, /not configured/);
  }
  await db.booking.update({
    where: { id: created.id },
    data: { holdExpiresAt: new Date(Date.now() - 1000) },
  });
  const afterExpiry = await fetch(
    `${base}/api/availability?pickup=${encodeURIComponent(pickup.toISOString())}&returnAt=${encodeURIComponent(returnAt.toISOString())}`,
  );
  assert.ok(
    (await afterExpiry.json()).vehicles.some(
      (v: { id: string }) => v.id === car.id,
    ),
  );
  await db.user.update({ where: { id: userId }, data: { role: "MANAGER" } });
  const staffGps = await fetch(`${base}/api/admin/gps`, {
    headers: { Cookie: cookie },
  });
  assert.equal(staffGps.status, 200);
  assert.equal((await staffGps.json()).mock, true);
  const block = await fetch(`${base}/api/admin/vehicles/${car.id}/blocks`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      start: pickup.toISOString(),
      end: returnAt.toISOString(),
      reason: "Temporary maintenance test",
    }),
  });
  assert.equal(block.status, 200);
  const blocked = await fetch(
    `${base}/api/availability?pickup=${encodeURIComponent(pickup.toISOString())}&returnAt=${encodeURIComponent(returnAt.toISOString())}`,
  );
  assert.ok(
    !(await blocked.json()).vehicles.some(
      (v: { id: string }) => v.id === car.id,
    ),
  );
  await db.booking.update({
    where: { id: created.id },
    data: { status: "CONFIRMED" },
  });
  const handover = await fetch(`${base}/api/admin/rentals/${created.id}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      kind: "CHECKOUT",
      mileage: 1000,
      fuel: "Full",
      condition: "Synthetic inspection",
      acknowledgement: "Test acknowledgement",
    }),
  });
  assert.equal(handover.status, 200);
  const badReturn = await fetch(`${base}/api/admin/rentals/${created.id}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      kind: "RETURN",
      mileage: 900,
      fuel: "Full",
      condition: "Synthetic inspection",
      acknowledgement: "Test acknowledgement",
    }),
  });
  assert.equal(badReturn.status, 400);
  const returned = await fetch(`${base}/api/admin/rentals/${created.id}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      kind: "RETURN",
      mileage: 1200,
      fuel: "Full",
      condition: "Synthetic inspection",
      acknowledgement: "Test acknowledgement",
    }),
  });
  assert.equal(returned.status, 200);
  const staffReport = await fetch(`${base}/api/admin/reports`, {
    headers: { Cookie: cookie },
  });
  assert.equal(staffReport.status, 200);
  assert.match(await staffReport.text(), new RegExp(created.reference));
  assert.equal(
    (await db.booking.findUniqueOrThrow({ where: { id: created.id } })).status,
    "COMPLETED",
  );
  console.log(
    "PASS: authentication, role injection, concurrent booking conflict, pricing, hold expiry, GPS/report permissions, origin checks, missing payment key, maintenance blocks, handover, mileage validation, return and audited CSV export.",
  );
}
main()
  .finally(async () => {
    if (vehicleId) {
      const records = await db.booking.findMany({
        where: { vehicleId },
        select: { id: true },
      });
      await db.auditEvent.deleteMany({
        where: {
          OR: [
            { entityId: { in: records.map((b) => b.id) } },
            { actorId: userId },
          ],
        },
      });
      await db.inspection.deleteMany({
        where: { bookingId: { in: records.map((b) => b.id) } },
      });
      await db.payment.deleteMany({
        where: { bookingId: { in: records.map((b) => b.id) } },
      });
      await db.booking.deleteMany({ where: { vehicleId } });
      await db.vehicleBlock.deleteMany({ where: { vehicleId } });
      await db.vehicle.delete({ where: { id: vehicleId } });
    }
    if (userId) await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
