import { createCipheriv, hkdfSync, randomBytes } from "node:crypto";

// Domain-separated encryption key; identity numbers never enter logs or API responses.
export function encryptIdentity(value: string) {
  const secret =
    process.env.IDENTITY_ENCRYPTION_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error(
      "Identity storage is not configured. Please contact the rental team.",
    );
  const key = Buffer.from(
    hkdfSync("sha256", secret, "anlima-identity-v1", "ghana-card", 32),
  );
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}
