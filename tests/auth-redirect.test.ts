import test from "node:test";
import assert from "node:assert/strict";
import { safeAuthRedirect } from "../src/lib/auth-redirect";
test("sign-in preserves a car reservation destination", () => {
  assert.equal(
    safeAuthRedirect("/fleet/toyota-rav4?pickup=2027-01-10T10%3A00"),
    "/fleet/toyota-rav4?pickup=2027-01-10T10%3A00",
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
