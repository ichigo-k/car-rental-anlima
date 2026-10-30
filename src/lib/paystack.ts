import { db } from "./db";
import { providerKey } from "./payment-config";
import { recordVerifiedPayment } from "./payment-verification";
export const paymentKey = () => providerKey("PAYSTACK");
export async function verifyPayment(reference: string) {
  if (!/^[a-zA-Z0-9.=-]{1,200}$/.test(reference))
    throw new Error("Invalid payment reference.");
  const payment = await db.payment.findUnique({ where: { reference } });
  if (!payment || payment.provider !== "PAYSTACK")
    throw new Error("Payment not found.");
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${paymentKey()}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );
  const result = await response.json();
  if (!response.ok || !result.status || result.data?.status !== "success")
    throw new Error("Payment has not been verified yet.");
  if (result.data.reference !== reference)
    throw new Error("Payment reference mismatch.");
  return recordVerifiedPayment({
    reference,
    provider: "PAYSTACK",
    amount: result.data.amount,
    currency: result.data.currency,
  });
}
