import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FEES,
  cancellationTerms,
  returnCharges,
} from "../src/lib/fees";
const booking = {
  returnAt: new Date("2026-11-10T10:00:00Z"),
  dailyRate: 75000,
  days: 2,
};
const out = { fuel: "Full", mileage: 1000 };
test("charges late hours after the grace period, capped at a day's rate", () => {
  const at = (iso: string) => ({
    fuel: "Full",
    mileage: 1100,
    at: new Date(iso),
  });
  assert.deepEqual(
    returnCharges(DEFAULT_FEES, booking, out, at("2026-11-10T10:59:00Z")),
    [],
  );
  // 30 minutes past the grace period: one started hour at 10% of GH₵750.
  assert.equal(
    returnCharges(DEFAULT_FEES, booking, out, at("2026-11-10T11:30:00Z"))[0]
      .amount,
    7500,
  );
  // 20 hours late is capped at one day's rate.
  assert.equal(
    returnCharges(DEFAULT_FEES, booking, out, at("2026-11-11T07:00:00Z"))[0]
      .amount,
    75000,
  );
  // Back 50 hours after the due time, 49 after the grace period: two full days plus one hour.
  assert.equal(
    returnCharges(DEFAULT_FEES, booking, out, at("2026-11-12T12:00:00Z"))[0]
      .amount,
    157500,
  );
});
test("proposes fuel and mileage charges from ANLIMA's fee settings", () => {
  const fees = {
    ...DEFAULT_FEES,
    fuelPerQuarter: 10000,
    dailyKmAllowance: 200,
    excessKmFee: 150,
  };
  const charges = returnCharges(fees, booking, out, {
    fuel: "Half",
    mileage: 1450,
    at: booking.returnAt,
  });
  assert.deepEqual(
    charges.map((c) => [c.kind, c.amount]),
    [
      ["FUEL", 20000],
      ["MILEAGE", 7500],
    ],
  );
});
test("a car's own mileage rules override the defaults", () => {
  const charges = returnCharges(
    { ...DEFAULT_FEES, dailyKmAllowance: 1000, excessKmFee: 10 },
    { ...booking, vehicle: { dailyKmAllowance: 100, excessKmFee: 200 } },
    out,
    { fuel: "Full", mileage: 1300, at: booking.returnAt },
  );
  assert.deepEqual(
    charges.map((c) => [c.kind, c.amount]),
    [["MILEAGE", 20000]],
  );
});
test("proposes nothing that ANLIMA has not priced", () => {
  assert.deepEqual(
    returnCharges(DEFAULT_FEES, booking, out, {
      fuel: "Empty",
      mileage: 9000,
      at: booking.returnAt,
    }),
    [],
  );
});
test("keeps part of the rental only for late cancellations", () => {
  const fees = {
    ...DEFAULT_FEES,
    freeCancellationHours: 48,
    lateCancellationPercent: 25,
  };
  const pickup = new Date("2026-11-20T10:00:00Z");
  assert.deepEqual(
    cancellationTerms(
      fees,
      { pickup, rentalAmount: 200000 },
      new Date("2026-11-17T10:00:00Z"),
    ),
    { free: true, retained: 0 },
  );
  assert.deepEqual(
    cancellationTerms(
      fees,
      { pickup, rentalAmount: 200000 },
      new Date("2026-11-19T10:00:00Z"),
    ),
    { free: false, retained: 50000 },
  );
});
