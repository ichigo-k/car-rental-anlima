import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { daily, ranked, recordEvent, stats } from "../src/lib/site-analytics";
// Website analytics against the real database. Test visits are dated in 2001,
// so they never mix with real figures, and are removed afterwards.
const db = new PrismaClient();
const from = new Date("2001-03-01T00:00:00Z");
const to = new Date("2001-03-04T00:00:00Z");
const at = (day: number, hour: number, minute = 0) =>
  new Date(Date.UTC(2001, 2, day, hour, minute));
const phone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148";
const laptop = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0";
const visit = (ip: string, ua: string) => ({
  ip,
  userAgent: ua,
  doNotTrack: false,
});
const ev = (type: string, path: string, data?: Record<string, string>) => ({
  type,
  path,
  referrerHost: type === "pageview" && path === "/" ? "google.com" : null,
  data: data ?? null,
});
async function main() {
  // Day 1: a phone visitor views three pages and books; a laptop visitor bounces.
  await recordEvent(
    db,
    visit("10.0.0.1", phone),
    ev("pageview", "/"),
    at(1, 9),
  );
  await recordEvent(
    db,
    visit("10.0.0.1", phone),
    ev("pageview", "/fleet/honda-civic"),
    at(1, 9, 2),
  );
  await recordEvent(
    db,
    visit("10.0.0.1", phone),
    ev("car-viewed", "/fleet/honda-civic", { car: "honda-civic" }),
    at(1, 9, 2),
  );
  await recordEvent(
    db,
    visit("10.0.0.1", phone),
    ev("checkout-started", "/bookings", { provider: "PAYSTACK" }),
    at(1, 9, 8),
  );
  await recordEvent(
    db,
    visit("10.0.0.1", phone),
    ev("booking-confirmed", "/bookings"),
    at(1, 9, 10),
  );
  await recordEvent(
    db,
    visit("10.0.0.2", laptop),
    ev("pageview", "/"),
    at(1, 14),
  );
  // Day 3: the same phone comes back (a new code, a new visit). A bot and a
  // Do Not Track visitor are ignored.
  await recordEvent(
    db,
    visit("10.0.0.1", phone),
    ev("pageview", "/fleet"),
    at(3, 11),
  );
  assert.equal(
    await recordEvent(
      db,
      visit("10.0.0.3", "Googlebot/2.1"),
      ev("pageview", "/"),
      at(3, 12),
    ),
    false,
  );
  assert.equal(
    await recordEvent(
      db,
      { ...visit("10.0.0.4", laptop), doNotTrack: true },
      ev("pageview", "/"),
      at(3, 12),
    ),
    false,
  );
  const range = { from, to };
  const { current } = await stats(db, range);
  assert.deepEqual(current, {
    visits: 3,
    pageviews: 4,
    bounces: 2,
    totaltime: 600,
  });
  assert.deepEqual(
    (await daily(db, range)).map((d) => [d.day, d.visits, d.pageviews]),
    [
      ["2001-03-01", 2, 3],
      ["2001-03-02", 0, 0],
      ["2001-03-03", 1, 1],
      ["2001-03-04", 0, 0],
    ],
  );
  assert.deepEqual(await ranked(db, range, "path"), [
    { name: "/", value: 2 },
    { name: "/fleet", value: 1 },
    { name: "/fleet/honda-civic", value: 1 },
  ]);
  assert.deepEqual(await ranked(db, range, "referrerHost"), [
    { name: "google.com", value: 2 },
    { name: "", value: 2 },
  ]);
  assert.deepEqual(
    new Map((await ranked(db, range, "type")).map((r) => [r.name, r.value])),
    new Map([
      ["car-viewed", 1],
      ["checkout-started", 1],
      ["booking-confirmed", 1],
    ]),
  );
  // One visitor cannot flood the table.
  for (let i = 0; i < 305; i++)
    await recordEvent(
      db,
      visit("10.0.0.9", laptop),
      ev("pageview", "/"),
      at(2, 10, 0),
    );
  assert.equal(
    (await daily(db, range)).find((d) => d.day === "2001-03-02")?.pageviews,
    300,
    "300 events an hour per visitor at most",
  );
  console.log(
    "PASS: visits (one person per day), page views, bounces, visit length, daily series with empty days, top pages, referrers, funnel events, bots and Do Not Track ignored, per-visitor limit.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.siteEvent.deleteMany({ where: { at: { gte: from, lte: to } } });
    await db.$disconnect();
  });
