import "dotenv/config";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient, type FeeSettings } from "@prisma/client";
import { cookiesFrom, enrolMfa, testPhone, totp } from "./staff-mfa";
import { requireOfflineProviders } from "./offline-providers";
import { deletePhotoFile } from "../src/lib/photos";
requireOfflineProviders();
const db = new PrismaClient();
const base = "http://localhost:3000";
const suffix = randomBytes(6).toString("hex");
let userId: string | undefined;
let vehicleId: string | undefined;
let otherUserId: string | undefined;
const phone = testPhone();
// Real fee settings are restored after the run (null: none were saved).
let feesSnapshot: FeeSettings | null | undefined;
async function main() {
  const password = randomBytes(24).toString("hex");
  const signup = await fetch(`${base}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({
      name: "Integration Test",
      email: `smoke-${suffix}@example.com`,
      password,
      role: "ADMIN",
    }),
  });
  const account = await signup.json();
  assert.equal(signup.status, 200, JSON.stringify(account));
  userId = account.user.id;
  let cookie = signup.headers
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
  const unverified = await fetch(`${base}/api/bookings`, {
    method: "POST",
    headers,
    body,
  });
  assert.equal(unverified.status, 403, "booking needs confirmed contacts");
  assert.equal((await unverified.json()).code, "VERIFY_REQUIRED");
  const verifyMail = await db.notification.findFirstOrThrow({
    where: { template: "AUTH_VERIFY_EMAIL", recipient: account.user.email },
  });
  const confirmLink = verifyMail.body.match(/https?:\/\/\S+/)![0];
  assert.ok(
    (await fetch(confirmLink, { redirect: "manual" })).status < 400,
    "the emailed confirmation link works",
  );
  assert.equal(
    (await db.user.findUniqueOrThrow({ where: { id: userId } })).emailVerified,
    true,
  );
  const phoneCall = (path: string, payload: object) =>
    fetch(`${base}/api/auth/phone-number/${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  assert.equal(
    (await phoneCall("send-otp", { phoneNumber: "0241234" })).status,
    400,
    "malformed numbers are rejected",
  );
  assert.equal(
    (await phoneCall("send-otp", { phoneNumber: phone })).status,
    200,
  );
  const codeText = await db.notification.findFirstOrThrow({
    where: { template: "AUTH_PHONE_CODE", recipient: phone },
  });
  const code = codeText.body.match(/\b(\d{6})\b/)![1];
  assert.notEqual(
    (
      await phoneCall("verify", {
        phoneNumber: phone,
        code: code === "000000" ? "111111" : "000000",
        updatePhoneNumber: true,
        disableSession: true,
      })
    ).status,
    200,
    "a wrong code is refused",
  );
  assert.equal(
    (
      await phoneCall("verify", {
        phoneNumber: phone,
        code,
        updatePhoneNumber: true,
        disableSession: true,
      })
    ).status,
    200,
  );
  const confirmedUser = await db.user.findUniqueOrThrow({
    where: { id: userId },
  });
  assert.equal(confirmedUser.phoneNumberVerified, true);
  assert.equal(confirmedUser.phoneNumber, phone);
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
  assert.equal(created.phone, phone, "bookings use the confirmed number");
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
  const laterPickup = new Date(pickup.getTime() + 20 * 86400000);
  const unpaid = await fetch(`${base}/api/bookings`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...JSON.parse(body),
      pickup: laterPickup.toISOString(),
      returnAt: new Date(laterPickup.getTime() + 86400000).toISOString(),
    }),
  });
  assert.equal(unpaid.status, 200);
  const unpaidRef = (await unpaid.json()).reference;
  const cancelUnpaid = (h: Record<string, string>) =>
    fetch(`${base}/api/bookings/${unpaidRef}/cancel`, {
      method: "POST",
      headers: h,
    });
  assert.equal(
    (await cancelUnpaid({ Origin: base })).status,
    401,
    "anonymous visitors cannot cancel bookings",
  );
  assert.equal((await cancelUnpaid(headers)).status, 200);
  assert.equal(
    (await db.booking.findUniqueOrThrow({ where: { reference: unpaidRef } }))
      .status,
    "CANCELLED",
  );
  assert.equal(
    (await cancelUnpaid(headers)).status,
    409,
    "a cancelled booking cannot be cancelled again",
  );
  // Itemised pricing: length-of-rental discount, extras and driver rules.
  const tripStart = new Date(pickup.getTime() + 40 * 86400000);
  const trip = {
    pickup: tripStart.toISOString(),
    returnAt: new Date(tripStart.getTime() + 3 * 86400000).toISOString(),
  };
  const quoteFor = (options: object) =>
    fetch(`${base}/api/quotes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ vehicleId: car.id, ...trip, ...options }),
    });
  const threeDays = await quoteFor({ delivery: true });
  assert.equal(threeDays.status, 200);
  const q = await threeDays.json();
  assert.ok(q.durationPercent > 0, "3 days earns a discount");
  assert.equal(
    q.durationDiscount,
    Math.round((3 * 75000 * q.durationPercent) / 100),
  );
  assert.deepEqual(
    q.items.map((i: { kind: string }) => i.kind),
    ["RENTAL", "DURATION_DISCOUNT", "DELIVERY", "DEPOSIT"],
  );
  assert.equal(
    q.total,
    q.items.reduce((sum: number, i: { amount: number }) => sum + i.amount, 0),
    "the total equals its lines",
  );
  assert.equal(
    (await quoteFor({ withDriver: true })).status,
    400,
    "no driver service on a self-drive-only car",
  );
  const withExtras = await fetch(`${base}/api/bookings`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...JSON.parse(body),
      ...trip,
      delivery: true,
      deliveryAddress: "12 Test Street, Accra",
      expectedTotal: q.total,
    }),
  });
  assert.equal(withExtras.status, 200, await withExtras.clone().text());
  const extrasBooking = await db.booking.findUniqueOrThrow({
    where: { reference: (await withExtras.json()).reference },
    include: { items: true },
  });
  assert.equal(extrasBooking.total, q.total, "booked at the quoted total");
  assert.equal(extrasBooking.durationDiscount, q.durationDiscount);
  assert.equal(extrasBooking.deliveryAddress, "12 Test Street, Accra");
  assert.deepEqual(extrasBooking.items.map((i) => i.kind).sort(), [
    "DELIVERY",
    "DEPOSIT",
    "DURATION_DISCOUNT",
    "RENTAL",
  ]);
  await db.booking.update({
    where: { id: extrasBooking.id },
    data: { status: "CANCELLED" },
  });
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
  assert.equal(
    (await fetch(`${base}/api/admin/gps`, { headers: { Cookie: cookie } }))
      .status,
    403,
    "staff without two-step sign-in must be refused",
  );
  const enrolled = await enrolMfa(base, cookie, password);
  cookie = enrolled.cookie;
  headers.Cookie = cookie;
  const staffGps = await fetch(`${base}/api/admin/gps`, {
    headers: { Cookie: cookie },
  });
  assert.equal(staffGps.status, 200);
  assert.ok(
    ["mock", "tracksolid"].includes((await staffGps.json()).source),
    "GPS responses name their source",
  );
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
  const request = await fetch(
    `${base}/api/bookings/${created.reference}/cancel`,
    { method: "POST", headers },
  );
  assert.deepEqual(await request.json(), { result: "REQUESTED" });
  const requested = await db.booking.findUniqueOrThrow({
    where: { id: created.id },
  });
  assert.equal(requested.status, "CONFIRMED", "a paid booking is only flagged");
  assert.ok(requested.cancelRequestedAt);
  // Staff change to a confirmed booking (Guide AC-05): availability is
  // rechecked, the paid amount is untouched and the change is logged.
  const change = (extra: object) =>
    fetch(`${base}/api/admin/bookings/${created.id}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "CHANGE", vehicleId: car.id, ...extra }),
    });
  const later = (ms: number) => new Date(pickup.getTime() + ms).toISOString();
  const intoBlock = await change({
    pickup: later(3600000),
    returnAt: later(2 * 86400000 + 3600000),
    preview: true,
  });
  assert.equal(intoBlock.status, 200);
  assert.equal(
    (await intoBlock.json()).change.available,
    false,
    "a change into a maintenance block is not available",
  );
  const sameLength = await change({
    pickup: later(10 * 86400000),
    returnAt: later(12 * 86400000),
    preview: true,
  });
  const sameLengthPreview = (await sameLength.json()).change;
  assert.equal(sameLengthPreview.available, true);
  assert.equal(sameLengthPreview.difference, 0, "same length, same price");
  assert.equal(
    (
      await change({
        pickup: later(10 * 86400000),
        returnAt: later(13 * 86400000),
        reason: "no",
      })
    ).status,
    409,
    "a change needs a reason",
  );
  const longer = await change({
    pickup: later(10 * 86400000),
    returnAt: later(13 * 86400000),
    reason: "Customer extended the trip by a day",
    chargeDifference: true,
  });
  assert.equal(longer.status, 200, await longer.clone().text());
  const longerResult = (await longer.json()).change;
  assert.ok(longerResult.difference > 0, "a longer rental costs more");
  const moved = await db.booking.findUniqueOrThrow({
    where: { id: created.id },
    include: { changes: true, charges: true },
  });
  assert.equal(moved.pickup.toISOString(), later(10 * 86400000));
  assert.equal(moved.days, 3);
  assert.equal(moved.total, requested.total, "the amount paid is unchanged");
  assert.equal(moved.changes.length, 1);
  assert.equal(moved.changes[0].priceDifference, longerResult.difference);
  const changeCharge = moved.charges.find((c) => c.kind === "BOOKING_CHANGE");
  assert.equal(changeCharge?.amount, longerResult.difference);
  assert.equal(changeCharge?.status, "PROPOSED");
  assert.ok(
    await db.auditEvent.findFirst({
      where: { entityId: created.id, action: "BOOKING_CHANGED" },
    }),
    "the change is in the activity history",
  );
  assert.ok(
    await db.notification.findFirst({
      where: { bookingId: created.id, template: "BOOKING_CHANGED" },
    }),
    "the customer is told about the change",
  );
  // Put the booking back so the handover and return checks below are unchanged.
  await db.bookingCharge.delete({ where: { id: changeCharge!.id } });
  await db.booking.update({
    where: { id: created.id },
    data: {
      pickup: requested.pickup,
      returnAt: requested.returnAt,
      days: requested.days,
      dailyRate: requested.dailyRate,
    },
  });
  // Handover and return need photos (Guide §7). A minimal JPEG header is
  // enough for the server's file-type check.
  const testJpeg = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0xff, 0xd9,
  ]);
  const uploadPhoto = (kind: string, bytes: Uint8Array = testJpeg) => {
    const form = new FormData();
    form.append("file", new Blob([Uint8Array.from(bytes)]), "car.jpg");
    form.append("kind", kind);
    form.append("takenAt", new Date().toISOString());
    return fetch(`${base}/api/admin/rentals/${created.id}/photos`, {
      method: "POST",
      headers: { Origin: base, Cookie: headers.Cookie },
      body: form,
    });
  };
  const inspect = (kind: string, mileage: number, photoIds: string[]) =>
    fetch(`${base}/api/admin/rentals/${created.id}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        kind,
        mileage,
        fuel: "Full",
        condition: "Synthetic inspection",
        acknowledgement: "Test acknowledgement",
        photoIds,
      }),
    });
  assert.equal(
    (await inspect("CHECKOUT", 1000, [])).status,
    400,
    "a handover needs at least one photo",
  );
  assert.equal(
    (await uploadPhoto("CHECKOUT", new TextEncoder().encode("not an image")))
      .status,
    400,
    "only real images are accepted",
  );
  const handoverPhoto = await uploadPhoto("CHECKOUT");
  assert.equal(handoverPhoto.status, 200, await handoverPhoto.clone().text());
  const handoverPhotoId = (await handoverPhoto.json()).id as string;
  const shown = await fetch(`${base}/api/admin/photos/${handoverPhotoId}`, {
    headers: { Cookie: headers.Cookie },
  });
  assert.equal(shown.status, 200);
  assert.deepEqual(new Uint8Array(await shown.arrayBuffer()), testJpeg);
  assert.equal(
    (await fetch(`${base}/api/admin/photos/${handoverPhotoId}`)).status,
    403,
    "photos are for staff only",
  );
  const handover = await inspect("CHECKOUT", 1000, [handoverPhotoId]);
  assert.equal(handover.status, 200, await handover.clone().text());
  const handoverRecord = await db.inspection.findFirstOrThrow({
    where: { bookingId: created.id, kind: "CHECKOUT" },
    include: { photos: true },
  });
  assert.deepEqual(
    handoverRecord.photos.map((p) => p.id),
    [handoverPhotoId],
    "the photo is kept with its inspection",
  );
  assert.equal(
    (
      await fetch(`${base}/api/admin/photos/${handoverPhotoId}`, {
        method: "DELETE",
        headers: { Origin: base, Cookie: headers.Cookie },
      })
    ).status,
    409,
    "photos of a saved inspection cannot be removed",
  );
  const returnPhoto = await uploadPhoto("RETURN");
  assert.equal(returnPhoto.status, 200);
  const returnPhotoId = (await returnPhoto.json()).id as string;
  const badReturn = await inspect("RETURN", 900, [returnPhotoId]);
  assert.equal(badReturn.status, 400);
  assert.equal(
    (await inspect("RETURN", 1200, [handoverPhotoId])).status,
    400,
    "a handover photo cannot be reused for the return",
  );
  feesSnapshot = await db.feeSettings.findUnique({
    where: { id: "default" },
  });
  const saveFees = () =>
    fetch(`${base}/api/admin/settings/fees`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        lateGraceMinutes: 60,
        lateHourPercent: 10,
        fuelPerQuarter: 0,
        cleaningFee: 0,
        smokingFee: 0,
        dailyKmAllowance: 50,
        excessKmFee: 100,
        freeCancellationHours: 48,
        lateCancellationPercent: 0,
        discount3Days: 5,
        discount7Days: 10,
        discount14Days: 15,
        discount30Days: 20,
        deliveryFee: 15000,
        extraDriverFee: 10000,
        driverOvertimeHourly: 5000,
      }),
    });
  assert.equal((await saveFees()).status, 403, "only administrators set fees");
  await db.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
  assert.equal((await saveFees()).status, 200);
  await db.user.update({ where: { id: userId }, data: { role: "MANAGER" } });
  const returned = await inspect("RETURN", 1200, [returnPhotoId]);
  assert.equal(returned.status, 200, await returned.clone().text());
  const staffReport = await fetch(`${base}/api/admin/reports`, {
    headers: { Cookie: cookie },
  });
  assert.equal(staffReport.status, 200);
  assert.match(await staffReport.text(), new RegExp(created.reference));
  // Reports export exactly what the filters show, and every export is
  // recorded with its filters (Guide AC-09).
  const exportOf = async (query: string) => {
    const r = await fetch(`${base}/api/admin/reports?${query}`, {
      headers: { Cookie: cookie },
    });
    assert.equal(r.status, 200, query);
    return r.text();
  };
  // Data rows only: the header repeats the search text.
  const bookingRows = (csv: string) =>
    csv.split("\r\n").filter((line) => line.startsWith(`"AN-`));
  const onlyThis = await exportOf(`type=bookings&q=${created.reference}`);
  assert.match(onlyThis, /Filters: search/, "the export records its filters");
  assert.deepEqual(
    bookingRows(onlyThis).map((line) => line.split(",")[0]),
    [`"${created.reference}"`],
    "a filtered export contains only matching bookings",
  );
  assert.deepEqual(
    bookingRows(
      await exportOf(`type=bookings&q=${created.reference}&status=CANCELLED`),
    ),
    [],
    "a status filter excludes other bookings",
  );
  const screen = await fetch(
    `${base}/admin/reports?type=bookings&q=${created.reference}`,
    { headers: { Cookie: cookie } },
  );
  assert.match(await screen.text(), new RegExp(created.reference));
  assert.match(
    await exportOf(`type=fleet&vehicleId=${car.id}`),
    new RegExp(car.name),
  );
  for (const type of ["payments", "returns", "customers"])
    await exportOf(`type=${type}`);
  const exportAudit = await db.auditEvent.findFirst({
    where: { actorId: userId, action: "REPORT_EXPORTED", entityId: "bookings" },
    orderBy: { createdAt: "desc" },
  });
  assert.match(exportAudit?.detail ?? "", /status CANCELLED/);
  assert.equal(
    (await db.booking.findUniqueOrThrow({ where: { id: created.id } })).status,
    "RETURNED",
  );
  const lifecycle = (body: object) =>
    fetch(`${base}/api/admin/bookings/${created.id}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  const charge = await lifecycle({
    action: "ADD_CHARGE",
    charge: {
      kind: "FUEL",
      amount: 20000,
      reason: "Returned a quarter tank short",
    },
  });
  assert.equal(charge.status, 200);
  assert.equal(
    (await lifecycle({ action: "CLOSE" })).status,
    409,
    "a rental with an undecided charge must not close",
  );
  const proposed = await db.bookingCharge.findFirstOrThrow({
    where: { bookingId: created.id, kind: "FUEL" },
  });
  const mileage = await db.bookingCharge.findFirstOrThrow({
    where: { bookingId: created.id, kind: "MILEAGE" },
  });
  assert.equal(
    mileage.amount,
    10000,
    "200 km driven against a 2 × 50 km allowance at GHS 1 per km",
  );
  assert.equal(mileage.proposedBy, "SYSTEM");
  await db.user.update({ where: { id: userId }, data: { role: "AGENT" } });
  assert.equal(
    (
      await lifecycle({
        action: "DECIDE_CHARGE",
        chargeId: proposed.id,
        decision: "APPROVED",
      })
    ).status,
    403,
    "agents propose charges but cannot approve them",
  );
  await db.user.update({ where: { id: userId }, data: { role: "MANAGER" } });
  assert.equal(
    (
      await lifecycle({
        action: "DECIDE_CHARGE",
        chargeId: proposed.id,
        decision: "APPROVED",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await lifecycle({
        action: "DECIDE_CHARGE",
        chargeId: mileage.id,
        decision: "APPROVED",
      })
    ).status,
    200,
  );
  assert.equal((await lifecycle({ action: "CLOSE" })).status, 200);
  const closed = await db.booking.findUniqueOrThrow({
    where: { id: created.id },
  });
  assert.equal(closed.status, "CLOSED");
  assert.equal(closed.depositApplied, 30000);
  assert.ok(
    await db.notification.findFirst({
      where: { bookingId: created.id, template: "REVIEW_REQUEST" },
    }),
    "closing a rental asks the customer for a review",
  );
  const review = (payload: object) =>
    fetch(`${base}/api/reviews`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reference: created.reference, ...payload }),
    });
  const reviewMarker = `review-${randomBytes(4).toString("hex")}`;
  const reviewText = `Smooth pickup and a spotless car ${reviewMarker}.`;
  assert.equal(
    (await review({ rating: 5, body: "Too short", displayName: "Test R." }))
      .status,
    400,
  );
  assert.equal(
    (await review({ rating: 5, body: reviewText, displayName: "Test R." }))
      .status,
    200,
  );
  assert.equal(
    (await review({ rating: 4, body: reviewText, displayName: "Test R." }))
      .status,
    409,
    "one review per rental",
  );
  const homeHas = async () =>
    (await (await fetch(`${base}/`)).text()).includes(reviewMarker);
  assert.equal(await homeHas(), false, "pending reviews are not published");
  const posted = await db.review.findUniqueOrThrow({
    where: { bookingId: created.id },
  });
  const moderate = (action: string) =>
    fetch(`${base}/api/admin/reviews/${posted.id}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action }),
    });
  assert.equal(
    (await moderate("FEATURE")).status,
    409,
    "only approved reviews can be shown",
  );
  assert.equal((await moderate("APPROVE")).status, 200);
  assert.equal((await moderate("FEATURE")).status, 200);
  assert.equal(
    await homeHas(),
    true,
    "featured reviews appear on the home page",
  );
  assert.equal((await moderate("HIDE")).status, 200);
  assert.equal(await homeHas(), false, "hidden reviews disappear");
  assert.equal(
    (
      await lifecycle({
        action: "ADD_CHARGE",
        charge: { kind: "OTHER", amount: 100, reason: "After closure" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await fetch(`${base}/api/admin/staff`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "SIGN_OUT", userId }),
      })
    ).status,
    403,
    "managers cannot manage staff access",
  );
  await db.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
  const other = await fetch(`${base}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({
      name: "Integration Colleague",
      email: `smoke-colleague-${suffix}@example.com`,
      password: randomBytes(24).toString("hex"),
    }),
  });
  assert.equal(other.status, 200);
  otherUserId = (await other.json()).user.id;
  const staffAction = (body: object) =>
    fetch(`${base}/api/admin/staff`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await staffAction({
        action: "GRANT",
        email: `smoke-colleague-${suffix}@example.com`,
        role: "AGENT",
      })
    ).status,
    200,
  );
  const colleague = await db.user.findUniqueOrThrow({
    where: { id: otherUserId },
    include: { _count: { select: { sessions: true } } },
  });
  assert.equal(colleague.role, "AGENT");
  assert.equal(colleague._count.sessions, 0, "access changes end sessions");
  assert.equal(
    (await staffAction({ action: "SET_ROLE", userId, role: "AGENT" })).status,
    409,
    "administrators cannot change their own access",
  );
  assert.equal(
    (await staffAction({ action: "REVOKE", userId: otherUserId })).status,
    200,
  );
  assert.equal(
    (await db.user.findUniqueOrThrow({ where: { id: otherUserId } })).role,
    "CUSTOMER",
  );
  const signIn = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email: `smoke-${suffix}@example.com`, password }),
  });
  assert.equal(
    (await signIn.json()).twoFactorRedirect,
    true,
    "staff sign-in must ask for a second factor",
  );
  const pending = cookiesFrom(signIn);
  assert.equal(
    (await fetch(`${base}/api/admin/gps`, { headers: { Cookie: pending } }))
      .status,
    403,
    "a password alone must not open the staff workspace",
  );
  const secondFactor = await fetch(`${base}/api/auth/two-factor/verify-totp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      Cookie: pending,
    },
    body: JSON.stringify({ code: totp(enrolled.secret) }),
  });
  assert.equal(secondFactor.status, 200, await secondFactor.clone().text());
  assert.equal(
    (
      await fetch(`${base}/api/admin/gps`, {
        headers: { Cookie: cookiesFrom(secondFactor, pending) },
      })
    ).status,
    200,
  );
  assert.ok(
    await db.auditEvent.findFirst({
      where: { actorId: userId, action: "GPS_VIEWED" },
    }),
    "GPS access is audited",
  );
  const forgot = await fetch(`${base}/api/auth/request-password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({
      email: `smoke-${suffix}@example.com`,
      redirectTo: "/reset-password",
    }),
  });
  assert.equal(forgot.status, 200);
  const resetMail = await db.notification.findFirstOrThrow({
    where: {
      template: "AUTH_RESET_PASSWORD",
      recipient: `smoke-${suffix}@example.com`,
    },
  });
  const resetLink = await fetch(resetMail.body.match(/https?:\/\/\S+/)![0], {
    redirect: "manual",
  });
  const resetToken = new URL(
    resetLink.headers.get("location") ?? "",
    base,
  ).searchParams.get("token");
  assert.ok(resetToken, "the reset link leads to /reset-password with a token");
  const newPassword = randomBytes(24).toString("hex");
  assert.equal(
    (
      await fetch(`${base}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify({ newPassword, token: resetToken }),
      })
    ).status,
    200,
  );
  const signInWith = (pw: string) =>
    fetch(`${base}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({
        email: `smoke-${suffix}@example.com`,
        password: pw,
      }),
    });
  assert.equal(
    (await signInWith(password)).status,
    401,
    "old password stops working",
  );
  assert.equal((await signInWith(newPassword)).status, 200);
  console.log(
    "PASS: authentication, role injection, concurrent booking conflict, staff booking changes, pricing, itemised quotes with length-of-rental discounts and extras, hold expiry, GPS/report permissions, origin checks, missing payment key, maintenance blocks, customer cancellation and requests, handover and return photos, mileage validation, return, charge approval, admin-set fees and automatic mileage charges, rental closure, customer reviews with approval and featuring, email and phone confirmation before booking, password reset, MFA enforcement and two-step sign-in, staff access management, GPS access audit and audited CSV export.",
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
      await db.notification.deleteMany({
        where: {
          OR: [{ recipient: { contains: suffix } }, { recipient: phone }],
        },
      });
      await db.bookingCharge.deleteMany({
        where: { bookingId: { in: records.map((b) => b.id) } },
      });
      const photos = await db.inspectionPhoto.findMany({
        where: { bookingId: { in: records.map((b) => b.id) } },
      });
      for (const photo of photos) await deletePhotoFile(photo.storageKey);
      await db.inspectionPhoto.deleteMany({
        where: { id: { in: photos.map((p) => p.id) } },
      });
      await db.inspection.deleteMany({
        where: { bookingId: { in: records.map((b) => b.id) } },
      });
      await db.payment.deleteMany({
        where: { bookingId: { in: records.map((b) => b.id) } },
      });
      await db.notification.deleteMany({ where: { booking: { vehicleId } } });
      await db.bookingChange.deleteMany({
        where: { bookingId: { in: records.map((b) => b.id) } },
      });
      await db.booking.deleteMany({ where: { vehicleId } });
      await db.vehicleBlock.deleteMany({ where: { vehicleId } });
      await db.vehicle.delete({ where: { id: vehicleId } });
    }
    if (feesSnapshot === null)
      await db.feeSettings.deleteMany({ where: { id: "default" } });
    else if (feesSnapshot) {
      const { id, updatedAt, ...restored } = feesSnapshot;
      void updatedAt;
      await db.feeSettings.update({ where: { id }, data: restored });
    }
    if (userId) await db.user.delete({ where: { id: userId } });
    if (otherUserId) await db.user.delete({ where: { id: otherUserId } });
    await db.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
