"use client";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { displayPhone, smsNumber } from "@/lib/phone";
import { ResendCode } from "./resend-code";
export function VerifyAccount({
  email,
  emailVerified,
  phone,
  phoneVerified,
  next,
}: {
  email: string;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  next: string;
}) {
  const [emailConfirmed, setEmailConfirmed] = useState(emailVerified);
  const [emailSent, setEmailSent] = useState(false);
  const [codeSentTo, setCodeSentTo] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState(
    phoneVerified ? phone : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function sendCode(number: string) {
    const r = await authClient.phoneNumber.sendOtp({ phoneNumber: number });
    if (r.error) throw new Error(r.error.message || "Could not send the code.");
  }
  const done = emailConfirmed && !!verifiedPhone;
  // The email link usually opens in another tab or app, so check for the
  // confirmation every few seconds and whenever this tab is shown again.
  useEffect(() => {
    if (emailConfirmed) return;
    const check = async () => {
      const r = await authClient.getSession();
      if (r.data?.user.emailVerified) setEmailConfirmed(true);
    };
    const onVisible = () => {
      if (!document.hidden) void check();
    };
    const timer = setInterval(() => {
      if (!document.hidden) void check();
    }, 5000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [emailConfirmed]);
  // Both confirmed: carry on to where the customer was going.
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => window.location.assign(next), 1500);
    return () => clearTimeout(timer);
  }, [done, next]);
  return (
    <div className="verify-steps">
      <section className={emailConfirmed ? "verify-step done" : "verify-step"}>
        <h2>1. Email address</h2>
        {emailConfirmed ? (
          <p>✓ {email} is confirmed.</p>
        ) : (
          <>
            <p>
              We sent a confirmation link to <strong>{email}</strong>. Open it
              to confirm your email, then come back here.
            </p>
            <button
              type="button"
              className="button small secondary"
              disabled={busy || emailSent}
              onClick={() =>
                run(async () => {
                  const r = await authClient.sendVerificationEmail({
                    email,
                    callbackURL: `/account/email-confirmed?next=${encodeURIComponent(next)}`,
                  });
                  if (r.error)
                    throw new Error(
                      r.error.message || "Could not send the email.",
                    );
                  setEmailSent(true);
                })
              }
            >
              {emailSent
                ? "Email sent. Check your inbox"
                : "Send the link again"}
            </button>
          </>
        )}
      </section>
      <section className={verifiedPhone ? "verify-step done" : "verify-step"}>
        <h2>2. Mobile number</h2>
        {verifiedPhone ? (
          <p>✓ {displayPhone(verifiedPhone)} is confirmed.</p>
        ) : !codeSentTo ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const raw = String(new FormData(e.currentTarget).get("phone"));
              const number = smsNumber(raw);
              void run(async () => {
                if (!number)
                  throw new Error(
                    "Enter a Ghana number like 024 123 4567, or an international number starting with +.",
                  );
                await sendCode(number);
                setCodeSentTo(number);
              });
            }}
          >
            <label>
              Mobile number
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                defaultValue={phone ? displayPhone(phone) : ""}
                placeholder="024 123 4567"
                required
              />
            </label>
            <button className="button small" disabled={busy}>
              Text me a code
            </button>
          </form>
        ) : (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const code = String(new FormData(e.currentTarget).get("code"));
              void run(async () => {
                const r = await authClient.phoneNumber.verify({
                  phoneNumber: codeSentTo,
                  code,
                  updatePhoneNumber: true,
                  disableSession: true,
                });
                if (r.error)
                  throw new Error(
                    r.error.message || "That code did not match. Try again.",
                  );
                setVerifiedPhone(codeSentTo);
              });
            }}
          >
            <p>
              We texted a 6-digit code to {displayPhone(codeSentTo)}. It expires
              in 5 minutes.
            </p>
            <label>
              Code
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
              />
            </label>
            <button className="button small" disabled={busy}>
              Confirm number
            </button>
            <ResendCode
              disabled={busy}
              send={() => run(() => sendCode(codeSentTo))}
            />
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setCodeSentTo("");
                setError("");
              }}
            >
              Use a different number
            </button>
          </form>
        )}
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {done && (
        <>
          <p role="status">All set. Taking you on…</p>
          <a className="button" href={next}>
            Continue
          </a>
        </>
      )}
    </div>
  );
}
