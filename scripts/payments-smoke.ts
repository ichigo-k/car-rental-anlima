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
import {
  issueRefund,
  refreshPendingRefunds,
  resolveRefund,
} from "../src/lib/refunds";
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
// Refunds at the stand-in providers: how the next request behaves, what was
// asked for, and each refund's status there.
let refundMode: "ok" | "decline" | "timeout" | "error" = "ok";
const refundRequests: { url: string; body: any }[] = [];
const providerRefunds = new Map<string, { status: string }>();
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
    const refundCreate =
      (url.hostname === "api.paystack.co" && url.pathname === "/refund") ||
      /^\/v3\/transactions\/\d+\/refund$/.test(url.pathname);
    if (refundCreate) {
      refundRequests.push({
        url: url.pathname,
        body: JSON.parse(String(init?.body)),
      });
      if (refundMode === "timeout") throw new Error("socket hang up");
      if (refundMode === "error") return Response.json({}, { status: 502 });
      if (refundMode === "decline")
        return Response.json(
          { status: false, message: "Transaction has been fully reversed" },
          { status: 400 },
        );
      const id = String(70000 + providerRefunds.size);
      const paystack = url.hostname === "api.paystack.co";
      providerRefunds.set(id, { status: paystack ? "pending" : "completed" });
      return Response.json(
        paystack
          ? { status: true, data: { id: Number(id), status: "pending" } }
          : {
              status: "success",
              data: { id: Number(id), status: "completed" },
            },
      );
    }
    const refundLookup =
      /^\/refund\/\d+$/.test(url.pathname) ||
      /^\/v3\/refunds\/\d+$/.test(url.pathname);
    if (refundLookup) {
      const refund = providerRefunds.get(url.pathname.split("/").pop()!);
      assert(refund, "Unknown mocked refund");
      return Response.json(
        url.hostname === "api.paystack.co"
          ? { status: true, data: { status: refund.status } }
          : { status: "success", data: { status: refund.status } },
      );
    }
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
    // Refunds go back through the provider that took the payment (Guide §5).
    const actorId = userId!;
    const paid = await db.payment.findUniqueOrThrow({
      where: { reference: paystack.reference },
    });
    const refund = (amount: number, paymentId = paid.id) =>
      issueRefund({ paymentId, amount, reason: "Refund test", actorId });
    await assert.rejects(refund(paid.amount + 1), /At most/);
    const failedPayment = await db.payment.findFirstOrThrow({
      where: { bookingId: failed.id },
    });
    await assert.rejects(refund(100, failedPayment.id), /Only verified/);
    const partial = await refund(20000);
    assert.equal(partial.status, "PENDING");
    assert.deepEqual(refundRequests.at(-1)!.body, {
      transaction: paystack.reference,
      amount: 20000,
      merchant_note: "Refund test",
    });
    assert.ok(
      await db.notification.findFirst({
        where: { dedupeKey: { startsWith: `REFUND_STARTED:${partial.id}:` } },
      }),
      "the customer is told a refund has started",
    );
    providerRefunds.get(partial.providerRefundId!)!.status = "processed";
    const refundEvent = JSON.stringify({ event: "refund.processed", data: {} });
    assert.equal(
      (
        await paystackWebhook(
          new Request("http://localhost/api/webhooks/paystack", {
            method: "POST",
            headers: {
              "x-paystack-signature": createHmac(
                "sha512",
                process.env.PAYSTACK_SECRET_KEY,
              )
                .update(refundEvent)
                .digest("hex"),
            },
            body: refundEvent,
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (await db.refund.findUniqueOrThrow({ where: { id: partial.id } })).status,
      "PROCESSED",
      "a Paystack refund event prompts a status check",
    );
    refundMode = "timeout";
    const lost = await refund(10000);
    assert.equal(
      lost.status,
      "UNKNOWN",
      "a lost answer is not assumed either way",
    );
    refundMode = "ok";
    await assert.rejects(refund(1000), /still being confirmed/);
    await resolveRefund({ refundId: lost.id, sent: false, actorId });
    refundMode = "error";
    assert.equal(
      (await refund(5000)).status,
      "UNKNOWN",
      "a provider error is unconfirmed",
    );
    await resolveRefund({
      refundId: (
        await db.refund.findFirstOrThrow({
          where: { paymentId: paid.id, status: "UNKNOWN" },
        })
      ).id,
      sent: false,
      actorId,
    });
    refundMode = "decline";
    await assert.rejects(refund(5000), /fully reversed/);
    refundMode = "ok";
    const rest = await refund(paid.amount - 20000);
    assert.equal(
      rest.status,
      "PENDING",
      "failed refunds do not use up the amount",
    );
    await assert.rejects(refund(1), /At most/);
    assert.equal(
      (await db.payment.findUniqueOrThrow({ where: { id: paid.id } })).status,
      "SUCCESS",
      "the original payment record is unchanged",
    );
    const flwPaid = await db.payment.findFirstOrThrow({
      where: { bookingId: manual.id, status: "SUCCESS" },
    });
    const flw = await refund(12345, flwPaid.id);
    assert.match(
      refundRequests.at(-1)!.url,
      /^\/v3\/transactions\/\d+\/refund$/,
    );
    assert.equal(
      refundRequests.at(-1)!.body.amount,
      123.45,
      "Flutterwave takes cedis",
    );
    assert.equal(
      flw.status,
      "PENDING",
      "Flutterwave 'completed' is not yet paid out",
    );
    providerRefunds.get(flw.providerRefundId!)!.status = "completed-momo";
    await refreshPendingRefunds("FLUTTERWAVE");
    assert.equal(
      (await db.refund.findUniqueOrThrow({ where: { id: flw.id } })).status,
      "PROCESSED",
    );
    console.log(
      "PASS: both hosted checkouts, exact discounted totals, GHS conversion, ownership, signed webhooks, amount/currency/reference rejection, idempotency, expiry, availability, cross-provider duplicate protection, initialization failures, manual verification, and refunds (limits, partial refunds, status checks, lost answers, declines, Flutterwave units). Provider requests were mocked; no charge or refund was made.",
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
      await db.refund.deleteMany({
        where: { bookingId: { in: bookings.map((b) => b.id) } },
      });
      await db.payment.deleteMany({
        where: { bookingId: { in: bookings.map((b) => b.id) } },
      });
      await db.notification.deleteMany({ where: { booking: { vehicleId } } });
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
