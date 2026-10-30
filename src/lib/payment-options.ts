export const PAYMENT_PROVIDERS = ["PAYSTACK", "FLUTTERWAVE"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];
export type PaymentOption = {
  id: PaymentProvider;
  name: string;
  enabled: boolean;
};
export const providerName = (provider: PaymentProvider) =>
  provider === "PAYSTACK" ? "Paystack" : "Flutterwave";
export function paymentNoticeState(
  status: string | undefined,
  reviewCharge: boolean,
  requested: string | undefined,
) {
  if (
    !requested ||
    !["verified", "pending", "review", "cancelled"].includes(requested)
  )
    return null;
  if (status === "PAYMENT_REVIEW" || reviewCharge) return "review";
  if (status && ["CONFIRMED", "ACTIVE", "COMPLETED"].includes(status))
    return "verified";
  return requested === "cancelled" ? "cancelled" : "pending";
}
export function pesewasToGhs(amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new Error("Invalid payment amount.");
  return `${Math.floor(amount / 100)}.${(amount % 100).toString().padStart(2, "0")}`;
}
export function ghsToPesewas(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string")
    throw new Error("Invalid payment amount.");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) throw new Error("Invalid payment amount.");
  const amount =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new Error("Invalid payment amount.");
  return amount;
}
export function hostedCheckoutUrl(value: unknown, provider: PaymentProvider) {
  if (typeof value !== "string") throw new Error("Invalid checkout link.");
  const url = new URL(value);
  const host =
    provider === "PAYSTACK"
      ? "checkout.paystack.com"
      : "checkout.flutterwave.com";
  if (
    url.protocol !== "https:" ||
    url.hostname !== host ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("Invalid checkout link.");
  return url.toString();
}
