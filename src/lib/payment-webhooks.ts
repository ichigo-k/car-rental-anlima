import { createHmac, timingSafeEqual } from "node:crypto";
export function sameSecret(actual: string, expected: string) {
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}
export function validPaystackSignature(
  body: string,
  signature: string,
  key: string,
) {
  return (
    !!key &&
    sameSecret(signature, createHmac("sha512", key).update(body).digest("hex"))
  );
}
