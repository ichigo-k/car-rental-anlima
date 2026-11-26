import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanEvent, deviceOf, visitorCode } from "../src/lib/site-analytics";
test("keeps only known events, public paths and non-personal details", () => {
  const site = "anlimacarrental.com";
  assert.deepEqual(
    cleanEvent(
      {
        type: "car-viewed",
        path: "/fleet/honda-civic?ref=abc",
        referrer: "https://www.google.com/search?q=car+hire",
        data: { car: "honda-civic", email: "a@b.c", category: "Saloon" },
      },
      site,
    ),
    {
      type: "car-viewed",
      path: "/fleet/honda-civic",
      referrerHost: "google.com",
      data: { car: "honda-civic", category: "Saloon" },
    },
  );
  assert.equal(cleanEvent({ type: "pageview", path: "/bookings" }, site), null);
  assert.equal(
    cleanEvent({ type: "pageview", path: "/admin/payments" }, site),
    null,
  );
  assert.equal(cleanEvent({ type: "login", path: "/" }, site), null);
  assert.equal(
    cleanEvent({ type: "pageview", path: "https://evil.example/" }, site),
    null,
  );
  assert.equal(
    cleanEvent(
      {
        type: "pageview",
        path: "/",
        referrer: "https://anlimacarrental.com/fleet",
      },
      site,
    )?.referrerHost,
    null,
    "moving within the site is not a referral",
  );
});
test("visitor codes change every day and reveal nothing", () => {
  const a = visitorCode("secret", "2026-11-20", "41.66.1.2", "Mozilla/5.0");
  assert.equal(
    a,
    visitorCode("secret", "2026-11-20", "41.66.1.2", "Mozilla/5.0"),
  );
  assert.notEqual(
    a,
    visitorCode("secret", "2026-11-21", "41.66.1.2", "Mozilla/5.0"),
  );
  assert.ok(!a.includes("41.66"));
  assert.match(a, /^[0-9a-f]{20}$/);
});
test("tells phones, tablets and computers apart", () => {
  assert.equal(
    deviceOf(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148",
    ),
    "mobile",
  );
  assert.equal(
    deviceOf("Mozilla/5.0 (Linux; Android 14; SM-A546E) Mobile Safari/537.36"),
    "mobile",
  );
  assert.equal(
    deviceOf("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"),
    "tablet",
  );
  assert.equal(
    deviceOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0"),
    "desktop",
  );
});
