import test from "node:test";
import assert from "node:assert/strict";
import { createDecipheriv, hkdfSync } from "node:crypto";
import { encryptIdentity } from "../src/lib/identity";
import {
  ghanaCardInput,
  pickupPointsInput,
  licenceValidThrough,
  reservationInput,
} from "../src/lib/reservation";

test("Ghana Card input checks the format without claiming identity verification", () => {
  assert.equal(ghanaCardInput.parse(" gha-000000001-0 "), "GHA-000000001-0");
  assert.equal(ghanaCardInput.safeParse("12345").success, false);
});
test("pickup configurations reject empty and duplicate points", () => {
  assert.equal(pickupPointsInput.safeParse([]).success, false);
  assert.equal(
    pickupPointsInput.safeParse(["Airport", "Airport "]).success,
    false,
  );
  assert.deepEqual(pickupPointsInput.parse([" Airport desk "]), [
    "Airport desk",
  ]);
});
test("driver licences remain valid through the expiry day in Ghana time", () => {
  assert.equal(
    licenceValidThrough("2027-01-12", new Date("2027-01-12T18:00:00Z")),
    true,
  );
  assert.equal(
    licenceValidThrough("2027-01-11", new Date("2027-01-12T18:00:00Z")),
    false,
  );
});
test("new reservations require account contact details, identity and consent", () => {
  const data = {
    vehicleId: "car",
    pickup: "2027-01-10T10:00:00Z",
    returnAt: "2027-01-12T10:00:00Z",
    location: "Airport desk",
    customerName: "Test Customer",
    customerEmail: "test@example.com",
    phone: "+233 24 000 0000",
    ghanaCardNumber: "GHA-000000001-0",
    licenceNumber: "TEST-1234",
    licenceExpiry: "2027-12-31",
    terms: true,
  };
  assert.equal(reservationInput.safeParse(data).success, true);
  assert.equal(
    reservationInput.safeParse({ ...data, terms: false }).success,
    false,
  );
  assert.equal(
    reservationInput.safeParse({ ...data, ghanaCardNumber: "" }).success,
    false,
  );
  assert.equal(
    reservationInput.safeParse({ ...data, phone: "letters" }).success,
    false,
  );
});
test("identity ciphertext is randomised, reversible with the key and authenticated", () => {
  const previous = process.env.IDENTITY_ENCRYPTION_SECRET;
  process.env.IDENTITY_ENCRYPTION_SECRET =
    "synthetic-test-secret-at-least-32-characters";
  try {
    const value = "GHA-000000001-0";
    const encrypted = encryptIdentity(value);
    assert.notEqual(encrypted, encryptIdentity(value));
    assert.ok(!encrypted.includes(value));
    const [version, iv, tag, body] = encrypted.split(":");
    assert.equal(version, "v1");
    const key = Buffer.from(
      hkdfSync(
        "sha256",
        process.env.IDENTITY_ENCRYPTION_SECRET,
        "anlima-identity-v1",
        "ghana-card",
        32,
      ),
    );
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    assert.equal(
      Buffer.concat([
        decipher.update(Buffer.from(body, "base64")),
        decipher.final(),
      ]).toString(),
      value,
    );
    const tampered = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "base64"),
    );
    tampered.setAuthTag(Buffer.alloc(16));
    tampered.update(Buffer.from(body, "base64"));
    assert.throws(() => tampered.final());
  } finally {
    if (previous === undefined) delete process.env.IDENTITY_ENCRYPTION_SECRET;
    else process.env.IDENTITY_ENCRYPTION_SECRET = previous;
  }
});
