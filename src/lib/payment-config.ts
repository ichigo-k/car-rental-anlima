import type { PaymentOption, PaymentProvider } from "./payment-options";
export function paymentOptions(): PaymentOption[] {
  return [
    {
      id: "PAYSTACK",
      name: "Paystack",
      enabled: !!process.env.PAYSTACK_SECRET_KEY,
    },
    {
      id: "FLUTTERWAVE",
      name: "Flutterwave",
      enabled:
        !!process.env.FLUTTERWAVE_SECRET_KEY &&
        !!process.env.FLUTTERWAVE_WEBHOOK_SECRET,
    },
  ];
}
export function providerKey(provider: PaymentProvider) {
  const key =
    provider === "PAYSTACK"
      ? process.env.PAYSTACK_SECRET_KEY
      : process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key)
    throw new Error(
      `${provider === "PAYSTACK" ? "Paystack" : "Flutterwave"} is not configured yet. No payment has been taken.`,
    );
  return key;
}
