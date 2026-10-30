import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const base = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const email = `contact-smoke-${randomUUID()}@example.com`;
const input = {
  name: "Contact smoke test",
  email,
  phone: "",
  subject: "General Enquiry",
  message: "Synthetic enquiry used to verify Contact Us submissions.",
  website: "",
};
async function post(body: unknown, origin = base) {
  return fetch(`${base}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}
async function main() {
  try {
    assert.equal((await post(input, "https://untrusted.example")).status, 403);
    assert.equal((await post({ ...input, message: "short" })).status, 400);
    assert.equal((await post({ ...input, email: "invalid" })).status, 400);
    assert.equal(
      (await post({ ...input, website: "spam.example" })).status,
      400,
    );
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => post(input)),
    );
    assert.deepEqual(
      responses.map((r) => r.status).sort(),
      [201, 201, 201, 201, 201, 429],
    );
    const saved = await db.contactEnquiry.findMany({ where: { email } });
    assert.equal(saved.length, 5);
    assert.equal(new Set(saved.map((e) => e.reference)).size, 5);
    assert(
      saved.every(
        (e) => e.message === input.message && e.fingerprint.length === 64,
      ),
    );
    const inbox = await fetch(`${base}/admin/enquiries`, {
      redirect: "manual",
    });
    const inboxHtml = await inbox.text();
    assert([200, 307].includes(inbox.status));
    assert(inbox.headers.get("location")?.includes("/sign-in") || inboxHtml.includes("/sign-in"));
    assert(!inboxHtml.includes(input.message));
    console.log(
      "PASS: validation, origin checks, honeypot, concurrent submission limits, durable storage, and protected staff inbox.",
    );
  } finally {
    await db.contactEnquiry.deleteMany({ where: { email } });
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
