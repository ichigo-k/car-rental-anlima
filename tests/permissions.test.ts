import { test } from "node:test";
import assert from "node:assert/strict";
import { can, isStaffRole } from "../src/lib/permissions";
test("denies customers, unknown roles and missing roles by default", () => {
  for (const role of ["CUSTOMER", "SUPERUSER", "", undefined, null])
    assert.equal(can(role, "booking.read"), false);
  assert.equal(isStaffRole("CUSTOMER"), false);
});
test("keeps GPS, staff access and finance apart", () => {
  assert.ok(can("FLEET", "gps.view"));
  assert.ok(!can("FINANCE", "gps.view"));
  assert.ok(!can("AGENT", "gps.view"));
  assert.ok(can("ADMIN", "user.manage"));
  assert.ok(!can("MANAGER", "user.manage"));
  assert.ok(can("FINANCE", "payment.refund"));
  assert.ok(!can("AGENT", "payment.refund"));
  assert.ok(!can("FLEET", "booking.read"));
});
