import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  ghsToPesewas,
  pesewasToGhs,
  hostedCheckoutUrl,
  paymentNoticeState,
} from "../src/lib/payment-options";
test("return URL parameters cannot claim an unverified payment succeeded", () => {
  assert.equal(
    paymentNoticeState("PENDING_PAYMENT", false, "verified"),
    "pending",
  );
  assert.equal(paymentNoticeState(undefined, false, "verified"), "pending");
  assert.equal(paymentNoticeState("CONFIRMED", false, "pending"), "verified");
  assert.equal(paymentNoticeState("CONFIRMED", true, "verified"), "review");
  assert.equal(
    paymentNoticeState("PAYMENT_REVIEW", false, "verified"),
    "review",
  );
  assert.equal(
    paymentNoticeState("PENDING_PAYMENT", false, "cancelled"),
    "cancelled",
  );
});
import {
  validPaystackSignature,
  sameSecret,
} from "../src/lib/payment-webhooks";
import { assertChargeMatches } from "../src/lib/payment-verification";
test("payment providers retain exact pesewas when converting GHS amounts", () => {
  for (const [minor, major] of [
    [1, "0.01"],
    [105, "1.05"],
    [122456, "1224.56"],
    [150000, "1500.00"],
  ] as const) {
    assert.equal(pesewasToGhs(minor), major);
    assert.equal(ghsToPesewas(major), minor);
    assert.equal(ghsToPesewas(Number(major)), minor);
  }
  for (const invalid of [
    null,
    undefined,
    NaN,
    Infinity,
    -1,
    0,
    "1.001",
    "1e3",
    "",
    {},
    "9007199254740991",
  ])
    assert.throws(() => ghsToPesewas(invalid));
});
test("checkout links are HTTPS links owned by the chosen payment provider", () => {
  assert.equal(
    hostedCheckoutUrl("https://checkout.paystack.com/test", "PAYSTACK"),
    "https://checkout.paystack.com/test",
  );
  assert.equal(
    hostedCheckoutUrl(
      "https://checkout.flutterwave.com/v3/hosted/pay/test",
      "FLUTTERWAVE",
    ),
    "https://checkout.flutterwave.com/v3/hosted/pay/test",
  );
  for (const url of [
    "http://checkout.paystack.com/test",
    "https://checkout.paystack.com.evil.example/test",
    "https://checkout.flutterwave.com/test",
    "https://user:pass@checkout.paystack.com/test",
    "javascript:alert(1)",
  ])
    assert.throws(() => hostedCheckoutUrl(url, "PAYSTACK"));
});
test("webhooks reject changed payloads, wrong secrets, and malformed signatures", () => {
  const body = '{"event":"charge.success"}',
    key = "unit-test-only-secret";
  const signature = createHmac("sha512", key).update(body).digest("hex");
  assert(validPaystackSignature(body, signature, key));
  assert(!validPaystackSignature(body + " ", signature, key));
  assert(!validPaystackSignature(body, "", key));
  assert(!validPaystackSignature(body, "é".repeat(128), key));
  assert(sameSecret("unit-webhook-secret", "unit-webhook-secret"));
  assert(!sameSecret("wrong-secret", "unit-webhook-secret"));
  assert(!sameSecret("", ""));
});
test("settlement requires an exact provider, reference, amount, and GHS currency match", () => {
  const payment = {
    reference: "ANL-test-1",
    provider: "PAYSTACK",
    amount: 122456,
  };
  const charge = { ...payment, provider: "PAYSTACK" as const, currency: "GHS" };
  assert.doesNotThrow(() => assertChargeMatches(charge, payment));
  for (const mismatch of [
    { amount: 122455 },
    { currency: "USD" },
    { reference: "ANL-other" },
    { provider: "FLUTTERWAVE" as const },
    { amount: 122456.1 },
  ])
    assert.throws(() =>
      assertChargeMatches({ ...charge, ...mismatch }, payment),
    );
});
