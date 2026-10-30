import { test } from "node:test";
import assert from "node:assert/strict";
import { quote } from "../src/lib/pricing";
test("rounds partial rental days up and keeps refundable deposit separate", () =>
  assert.deepEqual(
    quote(
      new Date("2026-11-01T10:00:00Z"),
      new Date("2026-11-02T11:00:00Z"),
      75000,
      150000,
    ),
    {
      days: 2,
      dailyRate: 75000,
      rentalAmount: 150000,
      deposit: 150000,
      total: 300000,
    },
  ));
test("rejects reversed and invalid dates", () => {
  assert.throws(() => quote(new Date("invalid"), new Date(), 1, 1));
  assert.throws(() =>
    quote(new Date("2026-11-02"), new Date("2026-11-01"), 1, 1),
  );
});
