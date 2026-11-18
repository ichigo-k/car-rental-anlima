import { test } from "node:test";
import assert from "node:assert/strict";
import { NO_OPTIONS, priceRental, quote } from "../src/lib/pricing";
import { DEFAULT_FEES } from "../src/lib/fees";
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

const civic = {
  dailyRate: 90000,
  deposit: 400000,
  driverOption: "BOTH",
  withDriverRate: 110000,
};
const days = (n: number) =>
  [
    new Date("2026-12-01T10:00:00Z"),
    new Date(Date.parse("2026-12-01T10:00:00Z") + n * 86400000),
  ] as const;
test("applies the length-of-rental discount tiers", () => {
  const cases: [number, number][] = [
    [2, 0],
    [3, 5],
    [7, 10],
    [14, 15],
    [30, 20],
  ];
  for (const [n, percent] of cases) {
    const p = priceRental(...days(n), civic, NO_OPTIONS, DEFAULT_FEES);
    assert.equal(p.durationPercent, percent, `${n} days`);
    assert.equal(p.durationDiscount, Math.round((n * 90000 * percent) / 100));
  }
});
test("prices driver service and extras, and the total equals its lines", () => {
  const withDriver = priceRental(
    ...days(3),
    civic,
    { withDriver: true, delivery: true, extraDriver: false },
    DEFAULT_FEES,
  );
  assert.equal(withDriver.rentalAmount, 330000);
  assert.equal(withDriver.extrasAmount, 15000);
  assert.equal(
    withDriver.total,
    withDriver.items.reduce((sum, item) => sum + item.amount, 0),
  );
  const selfDrive = priceRental(
    ...days(1),
    civic,
    { withDriver: false, delivery: false, extraDriver: true },
    DEFAULT_FEES,
  );
  assert.equal(selfDrive.total, 90000 + 10000 + 400000);
});
test("enforces each car's driver option", () => {
  assert.throws(() =>
    priceRental(
      ...days(1),
      { ...civic, driverOption: "SELF_DRIVE", withDriverRate: null },
      { ...NO_OPTIONS, withDriver: true },
      DEFAULT_FEES,
    ),
  );
  assert.throws(() =>
    priceRental(
      ...days(1),
      { ...civic, driverOption: "CHAUFFEUR_ONLY" },
      NO_OPTIONS,
      DEFAULT_FEES,
    ),
  );
  assert.throws(() =>
    priceRental(
      ...days(1),
      civic,
      { withDriver: true, delivery: false, extraDriver: true },
      DEFAULT_FEES,
    ),
  );
});
