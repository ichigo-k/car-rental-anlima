import type { Refund } from "@prisma/client";
import { db } from "./db";
import { money } from "./catalogue";
import { providerKey } from "./payment-config";
import { pesewasToGhs } from "./payment-options";
import { smsNumber } from "./phone";
import { deliverSoon } from "./notify";

// Refunds go back through the provider that took the payment (Guide §5). The
// refund is recorded before the provider is asked, so a lost answer can never
// lead to a second refund: it becomes UNKNOWN and blocks further refunds on
// that payment until staff check the provider.
export class RefundError extends Error {}
export const VERIFIED_PAYMENT = ["SUCCESS", "SUCCESS_REVIEW"];
// Refunds that count against the amount still refundable.
const COUNTED = ["REQUESTED", "PENDING", "PROCESSED", "UNKNOWN"];
const OPEN = ["REQUESTED", "UNKNOWN"];

export function refundedTotals(refunds: Pick<Refund, "amount" | "status">[]) {
  const sum = (statuses: string[]) =>
    refunds
      .filter((r) => statuses.includes(r.status))
      .reduce((total, r) => total + r.amount, 0);
  return { committed: sum(COUNTED), processed: sum(["PROCESSED"]) };
}

// Provider status words, mapped to ours. Paystack: pending, processing,
// processed, failed. Flutterwave: "completed" means accepted and awaiting
// disbursement; completed-bank-transfer, completed-momo and similar are done.
export function mapProviderStatus(provider: string, raw: unknown) {
  const s = String(raw ?? "").toLowerCase();
  if (/fail|declin|revers|reject|cancel/.test(s)) return "FAILED";
  if (provider === "PAYSTACK")
    return s === "processed" ? "PROCESSED" : "PENDING";
  return s.startsWith("completed-") ? "PROCESSED" : "PENDING";
}

class Ambiguous extends Error {}
async function call(url: string, init: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    throw new Ambiguous(
      `No answer from the provider (${(e as Error).message}).`,
    );
  }
  const body = await response.json().catch(() => null);
  // A server error may or may not have created the refund.
  if (response.status >= 500)
    throw new Ambiguous(`The provider returned an error (${response.status}).`);
  return { ok: response.ok, body };
}

async function createAtProvider(
  provider: string,
  reference: string,
  amount: number,
  reason: string,
) {
  const key = providerKey(provider as "PAYSTACK" | "FLUTTERWAVE");
  if (!key) throw new RefundError("This payment provider is not configured.");
  const auth = { Authorization: `Bearer ${key}` };
  if (provider === "PAYSTACK") {
    const r = await call("https://api.paystack.co/refund", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction: reference,
        amount,
        merchant_note: reason.slice(0, 200),
      }),
    });
    if (!r.ok || r.body?.status !== true || r.body?.data?.id == null)
      throw new RefundError(r.body?.message || "Paystack declined the refund.");
    return { id: String(r.body.data.id), status: r.body.data.status };
  }
  const tx = await call(
    `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
    { headers: auth },
  );
  if (
    !tx.ok ||
    tx.body?.data?.tx_ref !== reference ||
    tx.body?.data?.id == null
  )
    throw new RefundError("Flutterwave could not find this payment.");
  const r = await call(
    `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(String(tx.body.data.id))}/refund`,
    {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(pesewasToGhs(amount)),
        comments: reason.slice(0, 200),
      }),
    },
  );
  if (!r.ok || r.body?.status !== "success" || r.body?.data?.id == null)
    throw new RefundError(
      r.body?.message || "Flutterwave declined the refund.",
    );
  return { id: String(r.body.data.id), status: r.body.data.status };
}

async function statusAtProvider(provider: string, refundId: string) {
  const key = providerKey(provider as "PAYSTACK" | "FLUTTERWAVE");
  if (!key) return null;
  const url =
    provider === "PAYSTACK"
      ? `https://api.paystack.co/refund/${encodeURIComponent(refundId)}`
      : `https://api.flutterwave.com/v3/refunds/${encodeURIComponent(refundId)}`;
  try {
    const r = await call(url, { headers: { Authorization: `Bearer ${key}` } });
    return r.ok && r.body?.data?.status != null
      ? String(r.body.data.status)
      : null;
  } catch {
    return null;
  }
}

const audit = (
  actorId: string,
  action: string,
  entityId: string,
  detail: string,
) => db.auditEvent.create({ data: { actorId, action, entityId, detail } });

// Tell the customer once the provider has accepted the refund.
async function queueRefundMessage(refund: Refund) {
  const b = await db.booking.findUnique({
    where: { id: refund.bookingId },
    include: { user: { select: { email: true } } },
  });
  if (!b) return;
  const name = b.customerName?.split(" ")[0] || "there";
  const email = b.customerEmail ?? b.user.email;
  const sms = smsNumber(b.phone);
  const text = `Hello ${name},\n\nWe have started a refund of ${money(refund.amount)} for booking ${b.reference}. It goes back to the card or Mobile Money wallet you paid with. Refunds usually arrive within 3 to 15 working days, depending on your bank or network.\n\nANLIMA Car Rental`;
  const rows = [
    email && {
      channel: "EMAIL",
      recipient: email,
      subject: `Your refund for ${b.reference}`,
      body: text,
    },
    sms && {
      channel: "SMS",
      recipient: sms,
      subject: null,
      body: `ANLIMA: refund of ${money(refund.amount)} for ${b.reference} started. It usually arrives within 3-15 working days.`,
    },
  ].filter(Boolean) as {
    channel: string;
    recipient: string;
    subject: string | null;
    body: string;
  }[];
  await db.notification.createMany({
    data: rows.map((r) => ({
      ...r,
      bookingId: b.id,
      template: "REFUND_STARTED",
      dedupeKey: `REFUND_STARTED:${refund.id}:customer:${r.channel}`,
    })),
    skipDuplicates: true,
  });
  deliverSoon();
}

export async function issueRefund(input: {
  paymentId: string;
  amount: number;
  reason: string;
  actorId: string;
}) {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0)
    throw new RefundError("Enter an amount to refund.");
  const refund = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${input.paymentId} FOR UPDATE`;
    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      include: { refunds: true },
    });
    if (!payment || !VERIFIED_PAYMENT.includes(payment.status))
      throw new RefundError("Only verified payments can be refunded.");
    if (payment.refunds.some((r) => OPEN.includes(r.status)))
      throw new RefundError(
        "Another refund on this payment is still being confirmed. Check its status first.",
      );
    const left = payment.amount - refundedTotals(payment.refunds).committed;
    if (input.amount > left)
      throw new RefundError(
        `At most ${money(left)} of this payment can still be refunded.`,
      );
    const created = await tx.refund.create({
      data: {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        amount: input.amount,
        reason: input.reason,
        requestedBy: input.actorId,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: "REFUND_REQUESTED",
        entityId: payment.bookingId,
        detail: `${payment.provider} ${payment.reference}: ${input.amount}; ${input.reason}`,
      },
    });
    return { created, payment };
  });
  const { created, payment } = refund;
  try {
    const result = await createAtProvider(
      payment.provider,
      payment.reference,
      created.amount,
      created.reason,
    );
    const status = mapProviderStatus(payment.provider, result.status);
    const saved = await db.refund.update({
      where: { id: created.id },
      data: {
        status,
        providerRefundId: result.id,
        providerStatus: String(result.status ?? ""),
        processedAt: status === "PROCESSED" ? new Date() : null,
      },
    });
    await audit(
      input.actorId,
      "REFUND_SENT",
      payment.bookingId,
      `${payment.provider} refund ${result.id}: ${created.amount}, ${status}`,
    );
    if (status !== "FAILED") await queueRefundMessage(saved);
    return saved;
  } catch (e) {
    const unknown = e instanceof Ambiguous;
    const saved = await db.refund.update({
      where: { id: created.id },
      data: {
        status: unknown ? "UNKNOWN" : "FAILED",
        lastError: (e as Error).message.slice(0, 500),
      },
    });
    await audit(
      input.actorId,
      unknown ? "REFUND_UNCONFIRMED" : "REFUND_FAILED",
      payment.bookingId,
      `${payment.provider} ${payment.reference}: ${(e as Error).message}`,
    );
    if (!unknown) throw new RefundError((e as Error).message);
    return saved;
  }
}

// Asks the provider for the latest status of a refund it accepted.
export async function refreshRefund(
  refund: Refund & { payment: { provider: string } },
) {
  if (refund.status !== "PENDING" || !refund.providerRefundId) return refund;
  const raw = await statusAtProvider(
    refund.payment.provider,
    refund.providerRefundId,
  );
  if (raw === null) return refund;
  const status = mapProviderStatus(refund.payment.provider, raw);
  const saved = await db.refund.update({
    where: { id: refund.id },
    data: {
      status,
      providerStatus: raw,
      processedAt: status === "PROCESSED" ? new Date() : null,
    },
  });
  if (status !== "PENDING")
    await audit(
      "SYSTEM",
      status === "PROCESSED" ? "REFUND_PROCESSED" : "REFUND_FAILED",
      refund.bookingId,
      `${refund.payment.provider} refund ${refund.providerRefundId}: ${raw}`,
    );
  return saved;
}

export async function refreshPendingRefunds(provider?: string) {
  const pending = await db.refund.findMany({
    where: {
      status: "PENDING",
      ...(provider ? { payment: { provider } } : {}),
    },
    include: { payment: { select: { provider: true } } },
    take: 50,
  });
  for (const refund of pending) await refreshRefund(refund);
  return pending.length;
}

// After checking the provider's dashboard, staff settle a refund whose
// outcome was lost: it was sent (with the provider's refund id, if shown) or
// it was not.
export async function resolveRefund(input: {
  refundId: string;
  sent: boolean;
  providerRefundId?: string;
  actorId: string;
}) {
  const refund = await db.refund.findUnique({ where: { id: input.refundId } });
  if (!refund || refund.status !== "UNKNOWN")
    throw new RefundError("Only refunds awaiting confirmation can be settled.");
  const saved = await db.refund.update({
    where: { id: refund.id },
    data: input.sent
      ? {
          status: input.providerRefundId ? "PENDING" : "PROCESSED",
          providerRefundId: input.providerRefundId || null,
          processedAt: input.providerRefundId ? null : new Date(),
        }
      : { status: "FAILED" },
  });
  await audit(
    input.actorId,
    input.sent ? "REFUND_CONFIRMED" : "REFUND_NOT_SENT",
    refund.bookingId,
    `Refund ${refund.id}: ${input.sent ? "sent" : "not sent"}${input.providerRefundId ? `, provider id ${input.providerRefundId}` : ""}`,
  );
  if (input.sent) await queueRefundMessage(saved);
  return saved;
}
