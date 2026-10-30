import test from "node:test";
import assert from "node:assert/strict";
import { discountFor } from "../src/lib/discount";
test("discounts use integer pesewas and apply only to rental charges", () => {
  assert.equal(discountFor(190000, "PERCENT", 15), 28500);
  assert.equal(discountFor(190000, "FIXED", 20000), 20000);
  assert.equal(190000 - discountFor(190000, "PERCENT", 15) + 150000, 311500);
});
test("discounts retain the minimum rental charge and reject invalid percentages", () => {
  assert.equal(discountFor(10000, "FIXED", 50000), 9900);
  assert.equal(discountFor(100, "PERCENT", 90), 0);
  assert.equal(discountFor(10000, "PERCENT", 100), 0);
  assert.equal(discountFor(10000, "FIXED", -1), 0);
});
