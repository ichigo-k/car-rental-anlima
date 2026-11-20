import { test } from "node:test";
import assert from "node:assert/strict";
import { isPrivatePath, withoutQuery } from "../src/lib/analytics";
test("analytics never counts private pages", () => {
  for (const p of [
    "/admin",
    "/admin/bookings",
    "/bookings",
    "/account/documents",
    "/sign-in",
    "/reset-password",
  ])
    assert.equal(isPrivatePath(p), true, p);
  for (const p of [
    "/",
    "/fleet",
    "/fleet/honda-civic",
    "/how-it-works",
    "/administration",
  ])
    assert.equal(isPrivatePath(p), false, p);
});
test("addresses leave without query strings", () => {
  assert.equal(
    withoutQuery("/bookings?payment=verified&reference=AN-1"),
    "/bookings",
  );
  assert.equal(
    withoutQuery("https://google.com/search?q=car+hire#x"),
    "https://google.com/search",
  );
  assert.equal(withoutQuery(undefined), "");
});
