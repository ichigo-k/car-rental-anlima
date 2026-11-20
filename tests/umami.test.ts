import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
// The Umami client against a local stand-in that answers in the documented
// shapes. Nothing reaches Umami.
test("reads totals, a full daily series and rankings from Umami", async () => {
  const seen: { path: string; auth?: string }[] = [];
  let status = 200;
  const server = createServer((req, res) => {
    const url = new URL(req.url!, "http://x");
    seen.push({
      path: url.pathname + url.search,
      auth: req.headers.authorization,
    });
    res.writeHead(status, { "Content-Type": "application/json" });
    if (url.pathname.endsWith("/stats"))
      return res.end(
        JSON.stringify({
          pageviews: 120,
          visitors: 40,
          visits: 50,
          bounces: 20,
          totaltime: 3000,
          comparison: {
            pageviews: 100,
            visitors: { value: 32 },
            visits: 40,
            bounces: 18,
            totaltime: 2000,
          },
        }),
      );
    if (url.pathname.endsWith("/pageviews"))
      return res.end(
        JSON.stringify({
          pageviews: [
            { x: "2026-11-18 00:00:00", y: 30 },
            { x: "2026-11-20T00:00:00Z", y: 12 },
          ],
          sessions: [{ x: "2026-11-18 00:00:00", y: 9 }],
        }),
      );
    return res.end(
      JSON.stringify([
        { x: "/fleet", y: 70, t: "" },
        { x: null, y: 3 },
      ]),
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.UMAMI_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  process.env.UMAMI_API_KEY = "test-key";
  process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = "site-1";
  try {
    const { stats, daily, ranked, umamiReady } =
      await import("../src/lib/umami");
    assert.equal(umamiReady(), true);
    const range = {
      from: new Date("2026-11-18T08:00:00Z"),
      to: new Date("2026-11-20T09:00:00Z"),
    };
    const t = await stats(range);
    assert.deepEqual(t.current, {
      visitors: 40,
      visits: 50,
      pageviews: 120,
      bounces: 20,
      totaltime: 3000,
    });
    assert.equal(
      t.previous?.visitors,
      32,
      "accepts { value } as well as numbers",
    );
    const days = await daily(range);
    assert.deepEqual(
      days.map((d) => [d.day, d.visits, d.pageviews]),
      [
        ["2026-11-18", 9, 30],
        ["2026-11-19", 0, 0],
        ["2026-11-20", 0, 12],
      ],
    );
    assert.deepEqual(await ranked(range, "path"), [
      { name: "/fleet", value: 70 },
      { name: "", value: 3 },
    ]);
    assert.ok(seen.every((s) => s.auth === "Bearer test-key"));
    assert.match(
      seen[0].path,
      /^\/v1\/websites\/site-1\/stats\?startAt=\d+&endAt=\d+&compare=prev$/,
    );
    status = 401;
    const { UmamiError } = await import("../src/lib/umami");
    await assert.rejects(ranked(range, "referrer"), UmamiError);
  } finally {
    server.close();
  }
});
