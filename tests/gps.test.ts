import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  parseTracksolidTime,
  signParams,
  tracksolidConfig,
  tracksolidTime,
} from "../src/lib/tracksolid";
import { normalise } from "../src/lib/gps";
test("signs Tracksolid requests as documented", () => {
  // Docs: foo=1, bar=2, foo_bar=3, foobar=4 → bar2foo1foo_bar3foobar4,
  // wrapped in the app secret, MD5, upper case. sign and empty values excluded.
  const expected = createHash("md5")
    .update("secretbar2foo1foo_bar3foobar4secret")
    .digest("hex")
    .toUpperCase();
  assert.equal(
    signParams(
      { foo: "1", bar: "2", foo_bar: "3", foobar: "4", sign: "x", empty: "" },
      "secret",
    ),
    expected,
  );
});
test("uses UTC timestamps in the API format", () => {
  const at = new Date("2026-11-14T09:05:07.900Z");
  assert.equal(tracksolidTime(at), "2026-11-14 09:05:07");
  assert.equal(
    parseTracksolidTime("2026-11-14 09:05:07")?.toISOString(),
    "2026-11-14T09:05:07.000Z",
  );
  assert.equal(parseTracksolidTime("not a time"), null);
});
test("stays disconnected until every key is configured", () => {
  assert.equal(tracksolidConfig({ TRACKSOLID_APP_KEY: "k" }), null);
  const config = tracksolidConfig({
    TRACKSOLID_APP_KEY: "k",
    TRACKSOLID_APP_SECRET: "s",
    TRACKSOLID_ACCOUNT: "anlima",
    TRACKSOLID_PASSWORD: "pw",
    TRACKSOLID_NODE: "eu",
  });
  assert.equal(config?.url, "https://eu-open.tracksolidpro.com/route/rest");
  assert.equal(
    config?.passwordMd5,
    createHash("md5").update("pw").digest("hex").toLowerCase(),
  );
  const hashed = createHash("md5").update("pw").digest("hex");
  const fromHash = tracksolidConfig({
    TRACKSOLID_APP_KEY: "k",
    TRACKSOLID_APP_SECRET: "s",
    TRACKSOLID_ACCOUNT: "anlima",
    TRACKSOLID_PASSWORD_MD5: hashed.toUpperCase(),
  });
  assert.equal(fromHash?.passwordMd5, hashed, "user_pwd_md5 is sent lowercase");
  assert.equal(fromHash?.url, "https://hk-open.tracksolidpro.com/route/rest");
  assert.equal(
    tracksolidConfig({
      TRACKSOLID_APP_KEY: "k",
      TRACKSOLID_APP_SECRET: "s",
      TRACKSOLID_ACCOUNT: "anlima",
      TRACKSOLID_PASSWORD_MD5: "not-a-hash",
    }),
    null,
  );
});
test("labels positions honestly as live, stale, offline or without a fix", () => {
  const now = new Date("2026-11-14T10:00:00Z");
  const base = {
    imei: "123456789012345",
    status: "1",
    lat: 5.6,
    lng: -0.18,
    gpsTime: "2026-11-14 09:58:00",
    hbTime: "2026-11-14 09:59:00",
    speed: "42.5",
    accStatus: "1",
    direction: "-1",
  };
  const live = normalise("car", base, now);
  assert.equal(live.freshness, "LIVE");
  assert.equal(live.speedKmh, 42.5);
  assert.equal(live.ignitionOn, true);
  assert.equal(live.heading, null);
  assert.equal(
    normalise("car", { ...base, hbTime: "2026-11-14 09:30:00" }, now).freshness,
    "STALE",
  );
  assert.equal(
    normalise("car", { ...base, status: "0" }, now).freshness,
    "OFFLINE",
  );
  const expired = normalise("car", { ...base, lat: 0, lng: 0 }, now);
  assert.equal(expired.freshness, "NO_FIX");
  assert.equal(expired.latitude, null);
  assert.equal(normalise("car", undefined, now).freshness, "NO_FIX");
});
