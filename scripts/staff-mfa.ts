import { createHmac, randomInt } from "node:crypto";
// RFC 6238 TOTP, matching what an authenticator app shows, for smoke tests.
export function totp(secret: string, at = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.replace(/=+$/, "").toUpperCase())
    bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(
    bits.match(/.{8}/g)!.map((byte) => Number.parseInt(byte, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  return ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
export function cookiesFrom(response: Response, previous = "") {
  const jar = new Map(
    previous
      .split("; ")
      .filter(Boolean)
      .map((c) => [c.split("=")[0], c] as const),
  );
  for (const c of response.headers.getSetCookie()) {
    const pair = c.split(";")[0];
    jar.set(pair.split("=")[0], pair);
  }
  return [...jar.values()].join("; ");
}
// Enrols the signed-in account in two-step sign-in through the real API and
// returns the TOTP secret and the (possibly refreshed) session cookie.
export async function enrolMfa(base: string, cookie: string, password: string) {
  const headers = {
    "Content-Type": "application/json",
    Origin: base,
    Cookie: cookie,
  };
  const enable = await fetch(`${base}/api/auth/two-factor/enable`, {
    method: "POST",
    headers,
    body: JSON.stringify({ password }),
  });
  const body = await enable.json();
  if (!enable.ok) throw new Error(`MFA enable failed: ${JSON.stringify(body)}`);
  const secret = new URL(body.totpURI).searchParams.get("secret")!;
  const verify = await fetch(`${base}/api/auth/two-factor/verify-totp`, {
    method: "POST",
    headers,
    body: JSON.stringify({ code: totp(secret) }),
  });
  if (!verify.ok) throw new Error(`MFA verify failed: ${await verify.text()}`);
  return { secret, cookie: cookiesFrom(verify, cookie) };
}

// A unique, valid-looking Ghana mobile number for test accounts (233 20 …).
export function testPhone() {
  return `23320${String(randomInt(0, 10_000_000)).padStart(7, "0")}`;
}
