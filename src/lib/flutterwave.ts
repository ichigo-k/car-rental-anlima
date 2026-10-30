import { db } from "./db";
import { providerKey } from "./payment-config";
import { ghsToPesewas } from "./payment-options";
import { recordVerifiedPayment } from "./payment-verification";
export async function verifyFlutterwave(
  reference: string,
  transactionId?: string,
) {
  if (
    !/^[a-zA-Z0-9.=-]{1,200}$/.test(reference) ||
    (transactionId && !/^\d{1,30}$/.test(transactionId))
  )
    throw new Error("Invalid payment reference.");
  const payment = await db.payment.findUnique({ where: { reference } });
  if (!payment || payment.provider !== "FLUTTERWAVE")
    throw new Error("Payment not found.");
  const endpoint = transactionId
    ? `${encodeURIComponent(transactionId)}/verify`
    : `verify_by_reference?tx_ref=${encodeURIComponent(reference)}`;
  const response = await fetch(
    `https://api.flutterwave.com/v3/transactions/${endpoint}`,
    {
      headers: { Authorization: `Bearer ${providerKey("FLUTTERWAVE")}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );
  const result = await response.json();
  if (
    !response.ok ||
    result.status !== "success" ||
    result.data?.status !== "successful" ||
    (transactionId && String(result.data.id) !== transactionId)
  )
    throw new Error("Payment has not been verified yet.");
  if (result.data.tx_ref !== reference)
    throw new Error("Payment reference mismatch.");
  return recordVerifiedPayment({
    reference,
    provider: "FLUTTERWAVE",
    amount: ghsToPesewas(result.data.amount),
    currency: result.data.currency,
  });
}
