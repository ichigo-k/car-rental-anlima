import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowed,
  canTransition,
  settlement,
} from "../src/lib/booking-lifecycle";
test("follows the guide's status transitions", () => {
  assert.ok(canTransition("CONFIRMED", "CHECKED_OUT"));
  assert.ok(canTransition("CHECKED_OUT", "RETURNED"));
  assert.ok(canTransition("RETURNED", "CLOSED"));
  assert.ok(canTransition("CONFIRMED", "NO_SHOW"));
  assert.ok(canTransition("NO_SHOW", "CLOSED"));
  assert.ok(!canTransition("CHECKED_OUT", "CANCELLED"));
  assert.ok(!canTransition("CLOSED", "CONFIRMED"));
  assert.ok(!canTransition("CANCELLED", "CONFIRMED"));
});
test("only finance, managers and admins decide charges and close rentals", () => {
  assert.ok(allowed("proposeCharge", "AGENT"));
  assert.ok(!allowed("decideCharge", "AGENT"));
  assert.ok(allowed("decideCharge", "FINANCE"));
  assert.ok(!allowed("close", "FLEET"));
  assert.ok(!allowed("cancel", "CUSTOMER"));
});
test("applies approved charges to the deposit and reports any balance owed", () => {
  assert.deepEqual(
    settlement(150000, [
      { amount: 50000, status: "APPROVED" },
      { amount: 90000, status: "WAIVED" },
    ]),
    {
      approved: 50000,
      applied: 50000,
      refund: 100000,
      owed: 0,
      undecided: false,
    },
  );
  assert.deepEqual(
    settlement(150000, [
      { amount: 200000, status: "APPROVED" },
      { amount: 1000, status: "PROPOSED" },
    ]),
    {
      approved: 200000,
      applied: 150000,
      refund: 0,
      owed: 50000,
      undecided: true,
    },
  );
});
