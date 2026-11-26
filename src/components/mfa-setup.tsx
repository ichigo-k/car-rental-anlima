"use client";
import { useState } from "react";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";
// A short otpauth link: authenticator apps show "ANLIMA" with the email, and
// the smaller QR code scans reliably from a screen. Same key as the server's.
function authenticatorLink(key: string, email: string) {
  return `otpauth://totp/ANLIMA:${encodeURIComponent(email)}?secret=${key}&issuer=ANLIMA`;
}
export function MfaSetup({ email }: { email: string }) {
  const [step, setStep] = useState<"password" | "scan" | "codes">("password");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
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
  if (step === "codes")
    return (
      <div className="stack">
        <h2>Save your backup codes</h2>
        <p>
          Each code signs you in once if you lose your phone. Store them
          somewhere safe; they will not be shown again.
        </p>
        <ul className="backup-codes">
          {backupCodes.map((c) => (
            <li key={c}>
              <code>{c}</code>
            </li>
          ))}
        </ul>
        <a className="button" href="/admin">
          I have saved my codes. Continue
        </a>
      </div>
    );
  if (step === "scan")
    return (
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const code = String(new FormData(e.currentTarget).get("code"));
          void run(async () => {
            const r = await authClient.twoFactor.verifyTotp({ code });
            if (r.error)
              throw new Error(
                r.error.message || "That code did not match. Try again.",
              );
            setStep("codes");
          });
        }}
      >
        <h2>Scan this code</h2>
        <p>
          Open Google Authenticator, Microsoft Authenticator or a similar app,
          tap “+” and scan the code below from inside the app. On an iPhone,
          scanning with the Camera opens the Passwords app instead; that works
          too, and shows the 6-digit code there.
        </p>
        {qr && (
          <img
            src={qr}
            alt="Authenticator setup QR code"
            width={240}
            height={240}
          />
        )}
        <details>
          <summary>Can’t scan? Enter the key instead</summary>
          <p>
            In the app, choose “Enter a setup key”, use ANLIMA as the account
            name, paste or type this key (spaces are optional) and choose
            time-based.
          </p>
          <code className="mfa-secret">
            {secret.match(/.{1,4}/g)?.join(" ")}
          </code>
          <button
            type="button"
            className="button secondary"
            onClick={() => void navigator.clipboard?.writeText(secret)}
          >
            Copy key
          </button>
        </details>
        <label>
          6-digit code from the app
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
          />
        </label>
        <button className="button" disabled={busy}>
          Turn on two-step sign-in
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
    );
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        const password = String(new FormData(e.currentTarget).get("password"));
        void run(async () => {
          const r = await authClient.twoFactor.enable({ password });
          if (r.error || !r.data || r.data.method !== "totp")
            throw new Error(
              r.error?.message || "Could not start setup. Check your password.",
            );
          setBackupCodes(r.data.backupCodes);
          const key = new URL(r.data.totpURI).searchParams.get("secret") ?? "";
          setSecret(key);
          setQr(
            await QRCode.toDataURL(authenticatorLink(key, email), {
              margin: 2,
              width: 480,
              errorCorrectionLevel: "L",
            }),
          );
          setStep("scan");
        });
      }}
    >
      <label>
        Confirm your password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <button className="button" disabled={busy}>
        Set up authenticator
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
