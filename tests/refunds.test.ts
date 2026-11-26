import { test } from "node:test";
import assert from "node:assert/strict";
import { mapProviderStatus, refundedTotals } from "../src/lib/refunds";
test("maps provider refund states to ours", () => {
  assert.equal(mapProviderStatus("PAYSTACK", "pending"), "PENDING");
  assert.equal(mapProviderStatus("PAYSTACK", "processing"), "PENDING");
  assert.equal(mapProviderStatus("PAYSTACK", "processed"), "PROCESSED");
  assert.equal(mapProviderStatus("PAYSTACK", "failed"), "FAILED");
  // Flutterwave's "completed" means accepted, not yet paid out.
  assert.equal(mapProviderStatus("FLUTTERWAVE", "completed"), "PENDING");
  assert.equal(mapProviderStatus("FLUTTERWAVE", "pending-momo"), "PENDING");
  assert.equal(mapProviderStatus("FLUTTERWAVE", "completed-momo"), "PROCESSED");
  assert.equal(
    mapProviderStatus("FLUTTERWAVE", "completed-bank-transfer"),
    "PROCESSED",
  );
  assert.equal(mapProviderStatus("FLUTTERWAVE", "declined"), "FAILED");
  assert.equal(mapProviderStatus("PAYSTACK", undefined), "PENDING");
});
test("failed refunds never count against what can still be refunded", () => {
  const totals = refundedTotals([
    { amount: 100, status: "PROCESSED" },
    { amount: 200, status: "PENDING" },
    { amount: 400, status: "UNKNOWN" },
    { amount: 800, status: "FAILED" },
  ]);
  assert.deepEqual(totals, { committed: 700, processed: 100 });
});
