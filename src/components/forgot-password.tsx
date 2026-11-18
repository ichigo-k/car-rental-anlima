"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { displayPhone, smsNumber } from "@/lib/phone";
// Reset by email link or by SMS code. Replies never reveal whether an
// account exists for the email or number.
export function ForgotPassword() {
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [emailSent, setEmailSent] = useState("");
  const [codeSentTo, setCodeSentTo] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div className="stack">
        <p>Your password has been changed. Sign in with your new password.</p>
        <a className="button" href="/sign-in">
          Sign in
        </a>
      </div>
    );
  return (
    <div className="stack">
      <div className="filter-tabs" role="group" aria-label="Reset method">
        {(["email", "phone"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={method === m ? "selected" : ""}
            aria-pressed={method === m}
            onClick={() => {
              setMethod(m);
              setError("");
            }}
          >
            {m === "email" ? "By email" : "By text message"}
          </button>
        ))}
      </div>
      {method === "email" ? (
        emailSent ? (
          <p role="status">
            If an account uses {emailSent}, we have sent it a link to choose a
            new password. The link works for one hour.
          </p>
        ) : (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const email = String(new FormData(e.currentTarget).get("email"));
              void run(async () => {
                const r = await authClient.requestPasswordReset({
                  email,
                  redirectTo: "/reset-password",
                });
                if (r.error)
                  throw new Error(r.error.message || "Please try again.");
                setEmailSent(email);
              });
            }}
          >
            <label>
              Email address
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <button className="button" disabled={busy}>
              Email me a reset link
            </button>
          </form>
        )
      ) : !codeSentTo ? (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const number = smsNumber(
              String(new FormData(e.currentTarget).get("phone")),
            );
            void run(async () => {
              if (!number)
                throw new Error("Enter the mobile number on your account.");
              const r = await authClient.phoneNumber.requestPasswordReset({
                phoneNumber: number,
              });
              if (r.error)
                throw new Error(r.error.message || "Please try again.");
              setCodeSentTo(number);
            });
          }}
        >
          <label>
            Confirmed mobile number
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="024 123 4567"
              required
            />
          </label>
          <button className="button" disabled={busy}>
            Text me a code
          </button>
        </form>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              const r = await authClient.phoneNumber.resetPassword({
                phoneNumber: codeSentTo,
                otp: String(f.get("code")),
                newPassword: String(f.get("password")),
              });
              if (r.error)
                throw new Error(
                  r.error.message || "That code did not match. Try again.",
                );
              setDone(true);
            });
          }}
        >
          <p role="status">
            If {displayPhone(codeSentTo)} is confirmed on an account, we have
            texted it a 6-digit code. It expires in 5 minutes.
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
            />
          </label>
          <label>
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </label>
          <button className="button" disabled={busy}>
            Change password
          </button>
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function ResetPassword({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (done)
    return (
      <div className="stack">
        <p>Your password has been changed and other devices signed out.</p>
        <a className="button" href="/sign-in">
          Sign in
        </a>
      </div>
    );
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (f.get("password") !== f.get("confirm"))
          return setError("The two passwords do not match.");
        setBusy(true);
        setError("");
        const r = await authClient.resetPassword({
          newPassword: String(f.get("password")),
          token,
        });
        setBusy(false);
        if (r.error)
          return setError(
            "This reset link has expired or was already used. Ask for a new one.",
          );
        setDone(true);
      }}
    >
      <label>
        New password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </label>
      <label>
        Confirm new password
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </label>
      <button className="button" disabled={busy}>
        Change password
      </button>
      {error && (
        <p className="error" role="alert">
          {error}{" "}
          <a href="/forgot-password" className="text-link">
            Request a new link
          </a>
        </p>
      )}
    </form>
  );
}
