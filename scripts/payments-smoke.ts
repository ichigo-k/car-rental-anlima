import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { db } from "../src/lib/db";
import { startCheckout } from "../src/lib/payment-checkout";
import { verifyPayment } from "../src/lib/paystack";
import { verifyFlutterwave } from "../src/lib/flutterwave";
import { checkBookingPayment } from "../src/lib/payment-status";
import { POST as paystackWebhook } from "../src/app/api/webhooks/paystack/route";
import { POST as flutterwaveWebhook } from "../src/app/api/webhooks/flutterwave/route";
type Charge = {
  provider: string;
  reference: string;
  amount: number;
  currency: string;
  id: number;
  status: string;
  responseReference?: string;
};
const originalFetch = globalThis.fetch;
const keys = [
  "PAYSTACK_SECRET_KEY",
  "FLUTTERWAVE_SECRET_KEY",
  "FLUTTERWAVE_WEBHOOK_SECRET",
] as const;
const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
const charges = new Map<string, Charge>();
const initializations: Record<string, unknown>[] = [];
let initializationFails = false;
let userId: string | undefined, vehicleId: string | undefined;
const suffix = randomUUID().slice(0, 10);
async function main() {
  process.env.PAYSTACK_SECRET_KEY = "sk_test_unit_only_no_network";
  process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_TEST-unit-only-no-network";
  process.env.FLUTTERWAVE_WEBHOOK_SECRET = "unit-only-webhook-secret";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert(
      ["api.paystack.co", "api.flutterwave.com"].includes(url.hostname),
      "Unexpected external request in mocked payment test",
    );
    if (
      url.pathname.endsWith("/initialize") ||
      url.pathname === "/v3/payments"
    ) {
      if (initializationFails)
        return Response.json({ status: false }, { status: 502 });
      const body = JSON.parse(String(init?.body));
      initializations.push(body);
      const provider =
        url.hostname === "api.paystack.co" ? "PAYSTACK" : "FLUTTERWAVE";
      const reference = body.reference ?? body.tx_ref;
      charges.set(reference, {
        provider,
        reference,
        amount:
          provider === "PAYSTACK"
            ? body.amount
            : Math.round(Number(body.amount) * 100),
        currency: body.currency,
        id: 10000 + charges.size,
        status: provider === "PAYSTACK" ? "success" : "successful",
      });
      return Response.json(
        provider === "PAYSTACK"
          ? {
              status: true,
              data: {
                authorization_url: `https://checkout.paystack.com/${reference}`,
              },
            }
          : {
              status: "success",
              data: {
                link: `https://checkout.flutterwave.com/v3/hosted/pay/${reference}`,
              },
            },
      );
    }
    const reference =
      url.hostname === "api.paystack.co"
        ? decodeURIComponent(url.pathname.split("/").pop()!)
        : url.searchParams.get("tx_ref");
    const charge = reference
      ? charges.get(reference)
      : Array.from(charges.values()).find(
          (c) => String(c.id) === url.pathname.split("/")[3],
        );
    assert(charge, "Unknown mocked transaction");
    return Response.json(
      charge.provider === "PAYSTACK"
        ? {
            status: true,
            data: {
              status: charge.status,
              reference: charge.responseReference ?? charge.reference,
              amount: charge.amount,
              currency: charge.currency,
            },
          }
        : {
            status: "success",
            data: {
              id: charge.id,
              status: charge.status,
              tx_ref: charge.responseReference ?? charge.reference,
              amount: (charge.amount / 100).toFixed(2),
              currency: charge.currency,
            },
          },
    );
  };
  try {
    userId = (
      await db.user.create({
        data: {
          id: randomUUID(),
          name: `Payment test ${suffix}`,
          email: `payment-${suffix}@example.com`,
        },
      })
    ).id;
    vehicleId = (
      await db.vehicle.create({
        data: {
          slug: `payment-test-${suffix}`,
          name: "Payment Test Vehicle",
          category: "Sedan",
          seats: 5,
          dailyRate: 100000,
          deposit: 23456,
          image: "/images/figma/home-imgCar1.png",
          description: "Synthetic payment integration fixture",
        },
      })
    ).id;
    let sequence = 0;
    async function booking() {
      const pickup = new Date(Date.now() + (40 + sequence * 3) * 86400000);
      return db.booking.create({
        data: {
          reference: `ANL-PAY-${suffix}-${sequence++}`,
          userId: userId!,
          vehicleId: vehicleId!,
          pickup,
          returnAt: new Date(pickup.getTime() + 86400000),
          location: "Accra · City pickup",
          phone: "0000000000",
          licenceNumber: "TEST",
          licenceExpiry: new Date("2030-01-01"),
          days: 1,
          dailyRate: 100000,
          rentalAmount: 100000,
          deposit: 23456,
          discountAmount: 1000,
          total: 122456,
          termsVersion: "test",
          termsAcceptedAt: new Date(),
          holdExpiresAt: new Date(Date.now() + 15 * 60000),
        },
      });
    }
    const p = await booking();
    await startCheckout(p.reference, userId, "PAYSTACK");
    const paystack = Array.from(charges.values()).at(-1)!;
    assert.equal(initializations.at(-1)!.amount, 122456);
    assert.deepEqual(initializations.at(-1)!.channels, [
      "card",
      "mobile_money",
    ]);
    assert.equal((await verifyPayment(paystack.reference)).status, "CONFIRMED");
    await verifyPayment(paystack.reference);
    const event = JSON.stringify({
      event: "charge.success",
      data: { reference: paystack.reference },
    });
    const signature = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(event)
      .digest("hex");
    assert.equal(
      (
        await paystackWebhook(
          new Request("http://localhost/api/webhooks/paystack", {
            method: "POST",
            headers: { "x-paystack-signature": "invalid" },
            body: event,
          }),
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await paystackWebhook(
          new Request("http://localhost/api/webhooks/paystack", {
            method: "POST",
            headers: { "x-paystack-signature": signature },
            body: event,
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      await db.auditEvent.count({
        where: { entityId: p.id, action: "PAYMENT_VERIFIED" },
      }),
      1,
    );
    const f = await booking();
    await startCheckout(f.reference, userId, "FLUTTERWAVE");
    const flutter = Array.from(charges.values()).at(-1)!;
    assert.equal(initializations.at(-1)!.amount, "1224.56");
    assert.equal(
      initializations.at(-1)!.payment_options,
      "card,mobilemoneyghana",
    );
    flutter.amount -= 1;
    await assert.rejects(() => verifyFlutterwave(flutter.reference));
    assert.equal(
      (await db.booking.findUniqueOrThrow({ where: { id: f.id } })).status,
      "PENDING_PAYMENT",
    );
    flutter.amount += 1;
    flutter.currency = "USD";
    await assert.rejects(() => verifyFlutterwave(flutter.reference));
    flutter.currency = "GHS";
    flutter.responseReference = paystack.reference;
    await assert.rejects(() => verifyFlutterwave(flutter.reference));
    delete flutter.responseReference;
    await assert.rejects(() => verifyPayment(flutter.reference));
    await assert.rejects(() => verifyFlutterwave(paystack.reference));
    const flutterEvent = JSON.stringify({
      event: "charge.completed",
      data: { status: "successful", tx_ref: flutter.reference, id: flutter.id },
    });
    assert.equal(
      (
        await flutterwaveWebhook(
          new Request("http://localhost/api/webhooks/flutterwave", {
            method: "POST",
            headers: { "verif-hash": "wrong" },
            body: flutterEvent,
          }),
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await flutterwaveWebhook(
          new Request("http://localhost/api/webhooks/flutterwave", {
            method: "POST",
            headers: { "verif-hash": process.env.FLUTTERWAVE_WEBHOOK_SECRET! },
            body: flutterEvent,
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (await verifyFlutterwave(flutter.reference)).status,
      "CONFIRMED",
    );
    assert.equal(
      await db.auditEvent.count({
        where: { entityId: f.id, action: "PAYMENT_VERIFIED" },
      }),
      1,
    );
    const late = await booking();
    await startCheckout(late.reference, userId, "PAYSTACK");
    const lateRef = Array.from(charges.keys()).at(-1)!;
    await db.booking.update({
      where: { id: late.id },
      data: { holdExpiresAt: new Date(Date.now() - 1000) },
    });
    assert.equal((await verifyPayment(lateRef)).status, "PAYMENT_REVIEW");
    await assert.rejects(() =>
      startCheckout(late.reference, userId!, "PAYSTACK"),
    );
    const doubled = await booking();
    await startCheckout(doubled.reference, userId, "PAYSTACK");
    const first = Array.from(charges.keys()).at(-1)!;
    await startCheckout(doubled.reference, userId, "FLUTTERWAVE");
    const second = Array.from(charges.keys()).at(-1)!;
    const results = await Promise.all([
      verifyPayment(first),
      verifyFlutterwave(second),
    ]);
    assert.equal(results.filter((r) => r.review).length, 1);
    assert.equal(
      (await db.booking.findUniqueOrThrow({ where: { id: doubled.id } }))
        .status,
      "CONFIRMED",
    );
    assert.equal(
      await db.payment.count({
        where: { bookingId: doubled.id, status: "SUCCESS_REVIEW" },
      }),
      1,
    );
    const unavailable = await booking();
    await startCheckout(unavailable.reference, userId, "FLUTTERWAVE");
    const unavailableRef = Array.from(charges.keys()).at(-1)!;
    await db.vehicleBlock.create({
      data: {
        vehicleId,
        start: unavailable.pickup,
        end: unavailable.returnAt,
        reason: "Test maintenance",
      },
    });
    assert.equal(
      (await verifyFlutterwave(unavailableRef)).status,
      "PAYMENT_REVIEW",
    );
    const failed = await booking();
    initializationFails = true;
    await assert.rejects(() =>
      startCheckout(failed.reference, userId!, "PAYSTACK"),
    );
    initializationFails = false;
    assert.equal(
      await db.payment.count({
        where: { bookingId: failed.id, status: "FAILED" },
      }),
      1,
    );
    await assert.rejects(() =>
      startCheckout(failed.reference, "someone-else", "PAYSTACK"),
    );
    await assert.rejects(() =>
      checkBookingPayment(failed.reference, "someone-else"),
    );
    delete process.env.FLUTTERWAVE_WEBHOOK_SECRET;
    await assert.rejects(() =>
      startCheckout(failed.reference, userId!, "FLUTTERWAVE"),
    );
    process.env.FLUTTERWAVE_WEBHOOK_SECRET = "unit-only-webhook-secret";
    const manual = await booking();
    await startCheckout(manual.reference, userId, "FLUTTERWAVE");
    assert.equal(
      (await checkBookingPayment(manual.reference, userId)).status,
      "CONFIRMED",
    );
    console.log(
      "PASS: both hosted checkouts, exact discounted totals, GHS conversion, ownership, signed webhooks, amount/currency/reference rejection, idempotency, expiry, availability, cross-provider duplicate protection, initialization failures, and manual verification. Provider requests were mocked; no charge was made.",
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    if (vehicleId) {
      const bookings = await db.booking.findMany({
        where: { vehicleId },
        select: { id: true },
      });
      await db.auditEvent.deleteMany({
        where: { entityId: { in: bookings.map((b) => b.id) } },
      });
      await db.payment.deleteMany({
        where: { bookingId: { in: bookings.map((b) => b.id) } },
      });
      await db.booking.deleteMany({ where: { vehicleId } });
      await db.vehicleBlock.deleteMany({ where: { vehicleId } });
      await db.vehicle.delete({ where: { id: vehicleId } });
    }
    if (userId) await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
