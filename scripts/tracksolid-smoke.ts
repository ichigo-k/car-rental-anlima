import "dotenv/config";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { PrismaClient } from "@prisma/client";
// Exercises the Tracksolid client against a local stand-in for the Open API:
// signatures, token caching, renewal after code 1004 and location batching.
// No request reaches Tracksolid.
const db = new PrismaClient();
const SECRET = "test-secret";
const calls: Record<string, string>[] = [];
let tokenIssued = 0;
let rejectedOnce = false;
const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", async () => {
    const p = Object.fromEntries(new URLSearchParams(raw));
    calls.push(p);
    const { signParams } = await import("../src/lib/tracksolid");
    const reply = (body: object) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(body));
    };
    if (p.sign !== signParams(p, SECRET))
      return reply({ code: 1001, message: "Illegal signature" });
    if (p.method === "jimi.oauth.token.get") {
      tokenIssued += 1;
      return reply({
        code: 0,
        result: { accessToken: `token-${tokenIssued}`, expiresIn: 7200 },
      });
    }
    if (p.method === "jimi.device.location.get") {
      if (p.access_token === "token-1" && !rejectedOnce) {
        rejectedOnce = true;
        return reply({ code: 1004, message: "token is invalid" });
      }
      return reply({
        code: 0,
        result: p.imeis.split(",").map((imei) => ({
          imei,
          status: "1",
          lat: 5.6037,
          lng: -0.187,
          gpsTime: new Date().toISOString().slice(0, 19).replace("T", " "),
          hbTime: new Date().toISOString().slice(0, 19).replace("T", " "),
          speed: "30",
          accStatus: "1",
        })),
      });
    }
    reply({ code: 1001, message: "Unknown method" });
  });
});
async function main() {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const env = {
    TRACKSOLID_APP_KEY: "test-key",
    TRACKSOLID_APP_SECRET: SECRET,
    TRACKSOLID_ACCOUNT: "anlima-test",
    TRACKSOLID_PASSWORD: "test-password",
    TRACKSOLID_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
  };
  const saved = await db.integrationState.findUnique({
    where: { key: "tracksolid.token" },
  });
  if (saved) await db.integrationState.delete({ where: { key: saved.key } });
  try {
    const { tracksolidConfig, deviceLocations } =
      await import("../src/lib/tracksolid");
    const config = tracksolidConfig(env)!;
    const imeis = Array.from({ length: 150 }, (_, i) =>
      String(860000000000000 + i),
    );
    const first = await deviceLocations(config, imeis);
    assert.equal(first.length, 150);
    assert.equal(tokenIssued, 2, "a rejected token is renewed once");
    const locationCalls = calls.filter(
      (c) => c.method === "jimi.device.location.get",
    );
    assert.ok(
      locationCalls.every((c) => c.imeis.split(",").length <= 100),
      "at most 100 IMEIs per request",
    );
    const tokenCall = calls.find((c) => c.method === "jimi.oauth.token.get")!;
    assert.equal(tokenCall.user_id, "anlima-test");
    assert.match(tokenCall.user_pwd_md5, /^[0-9a-f]{32}$/);
    assert.match(tokenCall.timestamp, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    await deviceLocations(config, imeis.slice(0, 3));
    assert.equal(tokenIssued, 2, "the cached token is reused");
    console.log(
      "PASS: Tracksolid signing, UTC timestamps, token caching, renewal after code 1004 and 100-IMEI batching. No request reached Tracksolid.",
    );
  } finally {
    await db.integrationState.deleteMany({
      where: { key: "tracksolid.token" },
    });
    if (saved) await db.integrationState.create({ data: saved });
    server.close();
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
