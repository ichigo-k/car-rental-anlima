// Email through Resend and SMS through SMSOnlineGH. Each adapter throws
// NotConfigured until its keys are set, so messages wait in the outbox.
export class NotConfigured extends Error {}
export class ProviderError extends Error {
  constructor(
    message: string,
    // A permanent failure (bad address, rejected sender) is not retried.
    readonly permanent = false,
  ) {
    super(message);
  }
}

export function emailConfigured(env = process.env) {
  return !!(env.RESEND_API_KEY && env.EMAIL_FROM);
}
export function smsConfigured(env = process.env) {
  return !!(env.SMSONLINEGH_API_KEY && env.SMSONLINEGH_SENDER);
}

// https://resend.com/docs/api-reference/emails/send-email
export async function sendEmail(message: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}) {
  if (!emailConfigured())
    throw new NotConfigured("Email is not configured yet (Resend).");
  const response = await fetch(
    `${process.env.RESEND_BASE_URL ?? "https://api.resend.com"}/emails`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(process.env.EMAIL_REPLY_TO
          ? { reply_to: process.env.EMAIL_REPLY_TO }
          : {}),
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };
  if (!response.ok || !body.id)
    throw new ProviderError(
      `Resend ${response.status}: ${body.message ?? "send failed"}`,
      [400, 403, 422].includes(response.status),
    );
  return body.id;
}

// https://dev.smsonlinegh.com/docs/v5/http/rest/messaging/sms_non_personalised.html
// Success is handshake id 0 (HSHK_OK); HTTP 200 alone is not enough.
export async function sendSms(message: { to: string; text: string }) {
  if (!smsConfigured())
    throw new NotConfigured("SMS is not configured yet (SMSOnlineGH).");
  const response = await fetch(
    `${process.env.SMSONLINEGH_BASE_URL ?? "https://api.smsonlinegh.com"}/v5/message/sms/send`,
    {
      method: "POST",
      headers: {
        Authorization: `key ${process.env.SMSONLINEGH_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        text: message.text,
        type: 0,
        sender: process.env.SMSONLINEGH_SENDER,
        destinations: [message.to],
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  const body = (await response.json().catch(() => ({}))) as {
    handshake?: { id?: number; label?: string };
    data?: { batch?: string; destinations?: { id?: string }[] };
  };
  // The handshake code table is not published, so a low balance cannot be
  // told apart from a rejection: every failure is retried a few times.
  if (!response.ok || body.handshake?.id !== 0)
    throw new ProviderError(
      `SMSOnlineGH ${response.status}: ${body.handshake?.label ?? "send failed"}`,
    );
  return body.data?.destinations?.[0]?.id ?? body.data?.batch ?? "sent";
}
