import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanPath,
  errorFingerprint,
  problemsFrom,
  type OpsState,
} from "../src/lib/monitoring";
const calm: OpsState = {
  failedMessages: 0,
  stuckMessages: 0,
  messagingConfigured: true,
  unknownRefunds: 0,
  slowRefunds: 0,
  paymentReviews: 0,
  backup: null,
  gpsError: null,
};
test("error records never keep query strings, which can hold tokens", () => {
  assert.equal(cleanPath("/reset-password?token=abc123"), "/reset-password");
  assert.equal(cleanPath("/fleet/civic#book"), "/fleet/civic");
});
test("the same error on the same route is grouped", () => {
  const a = errorFingerprint("Cannot read x\n    at line 1", "/api/bookings");
  assert.equal(
    a,
    errorFingerprint("Cannot read x\n    at line 9", "/api/bookings"),
  );
  assert.notEqual(a, errorFingerprint("Cannot read x", "/api/quotes"));
});
test("nothing to report when all is well, and no backup alert before backups exist", () => {
  assert.deepEqual(problemsFrom(calm), []);
});
test("reports what needs attention", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const keys = (s: Partial<OpsState>) =>
    problemsFrom({ ...calm, ...s }, now).map((p) => p.key);
  assert.deepEqual(keys({ failedMessages: 2 }), ["messages-failed"]);
  assert.deepEqual(keys({ unknownRefunds: 1 }), ["refunds-unknown"]);
  assert.deepEqual(keys({ paymentReviews: 1 }), ["payment-review"]);
  assert.deepEqual(keys({ gpsError: "Tracksolid is unavailable" }), ["gps"]);
  assert.deepEqual(
    keys({ backup: { at: "2026-11-20T02:30:00Z", ok: true, detail: "" } }),
    [],
  );
  assert.deepEqual(
    keys({ backup: { at: "2026-11-18T02:30:00Z", ok: true, detail: "" } }),
    ["backup-late"],
  );
  assert.deepEqual(
    keys({
      backup: {
        at: "2026-11-20T02:30:00Z",
        ok: false,
        detail: "pg_dump failed",
      },
    }),
    ["backup-failed"],
  );
  assert.match(
    problemsFrom(
      { ...calm, stuckMessages: 3, messagingConfigured: false },
      now,
    )[0].detail,
    /keys are not set/,
  );
});
