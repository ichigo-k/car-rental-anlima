import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient({
  transactionOptions: { maxWait: 15000, timeout: 30000 },
});
const base = "http://localhost:3000",
  suffix = randomBytes(5).toString("hex");
const email = `offers-${suffix}@example.com`,
  password = `Preview-only-${randomBytes(12).toString("hex")}`;
let userId: string | undefined;
const carIds: string[] = [];
const extraCarIds: string[] = [];
const promotionIds: string[] = [];
async function main() {
  if (process.argv[2] === "--cleanup-preview") {
    const target = process.argv[3];
    assert.match(target ?? "", /^[a-f0-9]{10}$/);
    const user = await db.user.findUnique({
      where: { email: `offers-${target}@example.com` },
    });
    userId = user?.id;
    const cars = await db.vehicle.findMany({
      where: { slug: { startsWith: `offers-${target}-` } },
      select: { id: true },
    });
    carIds.push(...cars.map((c) => c.id));
    const promos = await db.promotion.findMany({
      where: { vehicleIds: { hasSome: carIds } },
    });
    promotionIds.push(
      ...promos
        .filter(
          (p) =>
            p.vehicleIds.every((id) => carIds.includes(id)) &&
            (p.code === `TEST-${target.toUpperCase()}` ||
              p.code === `FIX-${target.toUpperCase()}` ||
              (p.code === null && p.name === "Automatic test offer")),
        )
        .map((p) => p.id),
    );
    console.log("Removing only the named preview fixtures.");
    return;
  }
  const signup = await fetch(`${base}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ name: "Offers Test", email, password }),
  });
  assert.equal(signup.status, 200);
  const account = await signup.json();
  userId = account.user.id;
  const cookie = signup.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const headers = {
    "Content-Type": "application/json",
    Origin: base,
    Cookie: cookie,
  };
  for (let i = 0; i < 2; i++) {
    const car = await db.vehicle.create({
      data: {
        slug: `offers-${suffix}-${i}`,
        name: `Offers preview car ${i + 1}`,
        category: "Sedan",
        seats: 5,
        dailyRate: 100000,
        deposit: 50000,
        image: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb",
        description: "Temporary car for promotion integration checks.",
      },
    });
    carIds.push(car.id);
  }
  const offer = {
    name: `Offers test ${suffix}`,
    code: `TEST-${suffix.toUpperCase()}`,
    discountType: "PERCENT",
    value: 25,
    vehicleIds: carIds,
    minimumRental: 100000,
    maxUses: 1,
    startsAt: new Date(Date.now() - 60000).toISOString(),
    endsAt: new Date(Date.now() + 86400000).toISOString(),
    active: true,
  };
  assert.equal(
    (
      await fetch(`${base}/api/admin/promotions`, {
        method: "POST",
        headers,
        body: JSON.stringify(offer),
      })
    ).status,
    403,
    "customers cannot create promotions",
  );
  await db.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
  assert.equal(
    (
      await fetch(`${base}/api/admin/promotions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...offer, value: 100 }),
      })
    ).status,
    400,
    "invalid percentage rejected",
  );
  const created = await fetch(`${base}/api/admin/promotions`, {
    method: "POST",
    headers,
    body: JSON.stringify(offer),
  });
  assert.equal(created.status, 200);
  const promotion = await created.json();
  promotionIds.push(promotion.id);
  const auto = await fetch(`${base}/api/admin/promotions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...offer,
      name: "Automatic test offer",
      code: null,
      value: 10,
      maxUses: null,
    }),
  });
  assert.equal(auto.status, 200);
  promotionIds.push((await auto.json()).id);
  const pickup = new Date(Date.now() + 10 * 86400000),
    returnAt = new Date(pickup.getTime() + 2 * 86400000);
  const quoteBody = {
    vehicleId: carIds[0],
    pickup: pickup.toISOString(),
    returnAt: returnAt.toISOString(),
    couponCode: offer.code,
  };
  const preview = await fetch(`${base}/api/quotes`, {
    method: "POST",
    headers,
    body: JSON.stringify(quoteBody),
  });
  assert.equal(preview.status, 200);
  const previewQuote = await preview.json();
  assert.equal(previewQuote.discountAmount, 50000);
  assert.equal(previewQuote.deposit, 50000);
  assert.equal(previewQuote.total, 200000);
  const fixed = await fetch(`${base}/api/admin/promotions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...offer,
      name: "Fixed voucher test",
      code: `FIX-${suffix.toUpperCase()}`,
      discountType: "FIXED",
      value: 25000,
      maxUses: null,
    }),
  });
  assert.equal(fixed.status, 200);
  promotionIds.push((await fixed.json()).id);
  const fixedQuote = await fetch(`${base}/api/quotes`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...quoteBody,
      couponCode: `FIX-${suffix.toUpperCase()}`,
    }),
  });
  assert.equal(
    (await fixedQuote.json()).total,
    225000,
    "fixed-GHS vouchers use integer minor units",
  );
  const excludedCar = await db.vehicle.create({
    data: {
      slug: `offers-${suffix}-excluded`,
      name: "Excluded offers preview",
      category: "Sedan",
      seats: 5,
      dailyRate: 100000,
      deposit: 50000,
      image: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb",
      description: "Temporary vehicle excluded from test offers.",
    },
  });
  extraCarIds.push(excludedCar.id);
  const excluded = await fetch(`${base}/api/quotes`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...quoteBody,
      vehicleId: excludedCar.id,
    }),
  });
  assert.equal(
    excluded.status,
    400,
    "car-specific coupons cannot apply elsewhere",
  );
  assert.equal(
    (
      await fetch(`${base}/api/quotes`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...quoteBody, couponCode: "UNKNOWN-CODE" }),
      })
    ).status,
    400,
  );
  const bookingBody = {
    ...quoteBody,
    location: "Accra · Airport pickup",
    phone: "0000000000",
    customerName: "Offers Test",
    customerEmail: email,
    ghanaCardNumber: "GHA-000000001-0",
    licenceNumber: "TEST-ONLY",
    licenceExpiry: "2030-01-01",
    terms: true,
    expectedTotal: 200000,
    discountAmount: 999999999,
  };
  const attempts = await Promise.all(
    carIds.map((vehicleId) =>
      fetch(`${base}/api/bookings`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...bookingBody, vehicleId }),
      }),
    ),
  );
  assert.deepEqual(
    attempts.map((r) => r.status).sort(),
    [200, 409],
    "last coupon use is atomic across different cars",
  );
  const booking = await db.booking.findFirstOrThrow({
    where: { userId, promotionId: promotion.id },
  });
  assert.equal(booking.discountAmount, 50000);
  assert.equal(booking.total, 200000);
  assert.equal(booking.promotionName, offer.name);
  assert.equal(booking.couponCode, offer.code);
  const change = await fetch(`${base}/api/admin/promotions/${promotion.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ ...offer, name: "Edited campaign", active: false }),
  });
  assert.equal(change.status, 200);
  assert.equal(
    (await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).total,
    200000,
    "existing quote remains fixed",
  );
  assert.equal(
    (
      await fetch(`${base}/api/quotes`, {
        method: "POST",
        headers,
        body: JSON.stringify(quoteBody),
      })
    ).status,
    400,
    "paused coupons cannot be used",
  );
  const automatic = await fetch(`${base}/api/quotes`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...quoteBody, couponCode: "" }),
  });
  assert.equal(
    (await automatic.json()).total,
    230000,
    "automatic offer applies without stacking",
  );
  const wrongPrice = await fetch(`${base}/api/bookings`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...bookingBody,
      vehicleId: carIds.find((id) => id !== booking.vehicleId),
      couponCode: "",
      expectedTotal: 1,
    }),
  });
  assert.equal(wrongPrice.status, 409, "stale or forged quote rejected");
  await db.booking.update({
    where: { id: booking.id },
    data: { holdExpiresAt: new Date(Date.now() - 1000) },
  });
  assert.equal(
    (
      await fetch(`${base}/api/admin/promotions/${promotion.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(offer),
      })
    ).status,
    200,
  );
  const again = await fetch(`${base}/api/bookings`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...bookingBody,
      vehicleId: carIds.find((id) => id !== booking.vehicleId),
    }),
  });
  assert.equal(
    again.status,
    200,
    "expired unpaid holds release coupon capacity",
  );
  const editCar = await fetch(`${base}/api/admin/vehicles/${carIds[0]}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      name: "Updated offers preview",
      category: "Sedan",
      seats: 4,
      image: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb",
      description: "Updated integration test vehicle description.",
      dailyRate: 100000,
      deposit: 50000,
      status: "AVAILABLE",
      pickupPoints: ["Accra · Airport pickup"],
    }),
  });
  assert.equal(editCar.status, 200);
  assert.equal(
    (await db.vehicle.findUniqueOrThrow({ where: { id: carIds[0] } })).seats,
    4,
  );
  const bookingsPage = await fetch(
    `${base}/admin/bookings?q=${booking.reference}`,
    { headers: { Cookie: cookie } },
  );
  assert.equal(bookingsPage.status, 200);
  assert.ok((await bookingsPage.text()).includes(booking.reference));
  console.log(
    "PASS: staff-only promotions, percent validation, automatic offers, immutable discounted totals, coupon non-stacking, usage race, expiry capacity, stale-quote rejection, full car editing and booking search.",
  );
  if (process.argv.includes("--preview")) {
    console.log(
      JSON.stringify({ previewEmail: email, previewPassword: password }),
    );
    console.log("Press Enter to remove preview fixtures.");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 10 * 60 * 1000);
      process.stdin.once("data", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}
main()
  .finally(async () => {
    if (userId) {
      const bookings = await db.booking.findMany({
        where: { userId },
        select: { id: true },
      });
      const ids = bookings.map((b) => b.id);
      await db.auditEvent.deleteMany({ where: { actorId: userId } });
      await db.payment.deleteMany({ where: { bookingId: { in: ids } } });
      await db.inspection.deleteMany({ where: { bookingId: { in: ids } } });
      await db.booking.deleteMany({ where: { userId } });
    }
    await db.promotion.deleteMany({ where: { id: { in: promotionIds } } });
    await db.vehicle.deleteMany({
      where: { id: { in: [...carIds, ...extraCarIds] } },
    });
    if (userId) await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  })
  .catch((e) => {
    console.error("Promotion check failed:", e.message);
    process.exitCode = 1;
  });
