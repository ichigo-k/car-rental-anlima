import test from "node:test";
import assert from "node:assert/strict";
import {
  safeAuthRedirect,
  accountDestination,
  authContinuation,
} from "../src/lib/auth-redirect";
test("sign-in preserves a car reservation destination", () => {
  assert.equal(
    safeAuthRedirect("/fleet/toyota-rav4?pickup=2027-01-10T10%3A00"),
    "/fleet/toyota-rav4?pickup=2027-01-10T10%3A00",
  );
});

test("staff sign-in always leads to the staff workspace", () => {
  for (const role of ["ADMIN", "MANAGER", "AGENT", "FLEET", "FINANCE"]) {
    assert.equal(accountDestination(role), "/admin");
    assert.equal(accountDestination(role, "/bookings"), "/admin");
    assert.equal(accountDestination(role, "/fleet/toyota-rav4"), "/admin");
    assert.equal(
      accountDestination(role, "/admin/bookings?status=CONFIRMED"),
      "/admin/bookings?status=CONFIRMED",
    );
  }
  assert.equal(
    accountDestination("CUSTOMER", "/fleet/toyota-rav4?pickup=2027-01-10"),
    "/fleet/toyota-rav4?pickup=2027-01-10",
  );
});

test("authentication continuations reject loops and retain safe customer return URLs", () => {
  for (const target of [
    "/sign-in",
    "/sign-in?next=/sign-in",
    "/sign-in/?next=/bookings",
    "/auth/continue",
    "/auth/continue/?next=/bookings",
    "/api/auth/callback/google",
  ])
    assert.equal(safeAuthRedirect(target), "/bookings");
  assert.equal(
    authContinuation("/fleet/toyota-rav4?pickup=2027-01-10"),
    "/auth/continue?next=%2Ffleet%2Ftoyota-rav4%3Fpickup%3D2027-01-10",
  );
});
test("sign-in rejects external, protocol-relative and backslash destinations", () => {
  for (const target of [
    null,
    undefined,
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/\n/example.com",
  ])
    assert.equal(safeAuthRedirect(target), "/bookings");
});
