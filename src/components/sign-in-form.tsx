"use client";
import { useState } from "react";
import { GoogleLogo, FacebookLogo } from "@phosphor-icons/react";
import { safeAuthRedirect, authContinuation } from "@/lib/auth-redirect";
import { authClient as client } from "@/lib/auth-client";
export function SignInForm({
  providers = { google: false, facebook: false },
}: {
  providers?: { google: boolean; facebook: boolean };
}) {
  const [signup, setSignup] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [secondStep, setSecondStep] = useState(false);
  const [useBackup, setUseBackup] = useState(false);
  async function social(provider: "google" | "facebook") {
    if (busy || !providers[provider]) return;
    setBusy(true);
    setError("");
    const target = safeAuthRedirect(
      new URLSearchParams(window.location.search).get("next"),
    );
    try {
      const result = await client.signIn.social({
        provider,
        callbackURL: authContinuation(target),
        errorCallbackURL: `/sign-in?error=social&next=${encodeURIComponent(target)}`,
      });
      if (result.error)
        throw new Error(
          result.error.message || "Social sign-in could not be started.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (secondStep)
    return (
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const code = String(new FormData(e.currentTarget).get("code")).trim();
          try {
            const result = useBackup
              ? await client.twoFactor.verifyBackupCode({ code })
              : await client.twoFactor.verifyTotp({ code });
            if (result.error)
              throw new Error(
                result.error.message || "That code did not match. Try again.",
              );
            window.location.assign(
              authContinuation(
                safeAuthRedirect(
                  new URLSearchParams(window.location.search).get("next"),
                ),
              ),
            );
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <h2>Two-step sign-in</h2>
        <p>
          {useBackup
            ? "Enter one of the backup codes you saved when you set up two-step sign-in."
            : "Enter the 6-digit code from your authenticator app."}
        </p>
        <label>
          {useBackup ? "Backup code" : "Authentication code"}
          <input
            key={useBackup ? "backup" : "totp"}
            name="code"
            autoComplete="one-time-code"
            {...(useBackup
              ? { maxLength: 40 }
              : { inputMode: "numeric", pattern: "[0-9]{6}", maxLength: 6 })}
            required
            autoFocus
          />
        </label>
        <button className="button" disabled={busy}>
          {busy ? "Please wait…" : "Verify and sign in"}
        </button>
        <button
          type="button"
          className="text-link"
          onClick={() => {
            setUseBackup(!useBackup);
            setError("");
          }}
        >
          {useBackup
            ? "Use authenticator code"
            : "Lost your phone? Use a backup code"}
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
    );
  return (
    <>
      <div className="social-login-buttons">
        <button
          type="button"
          className="social-login-button"
          disabled={busy || !providers.google}
          onClick={() => void social("google")}
        >
          <GoogleLogo size={21} />
          Continue with Google
        </button>
        <button
          type="button"
          className="social-login-button"
          disabled={busy || !providers.facebook}
          onClick={() => void social("facebook")}
        >
          <FacebookLogo size={21} weight="fill" />
          Continue with Facebook
        </button>
      </div>
      {(!providers.google || !providers.facebook) && (
        <p className="social-login-note">
          More sign-in options are coming soon. You can use your email below.
        </p>
      )}
      <div className="auth-divider">
        <span>or continue with email</span>
      </div>
      <div className="filter-tabs">
        <button
          className={!signup ? "selected" : ""}
          onClick={() => setSignup(false)}
        >
          Sign in
        </button>
        <button
          className={signup ? "selected" : ""}
          onClick={() => setSignup(true)}
        >
          Create account
        </button>
      </div>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          const target = safeAuthRedirect(
            new URLSearchParams(window.location.search).get("next"),
          );
          try {
            const payload = {
              email: String(f.get("email")),
              password: String(f.get("password")),
            };
            const result = signup
              ? await client.signUp.email({
                  ...payload,
                  name: String(f.get("name")),
                  // The email link returns to the verify page to finish setup.
                  callbackURL: authContinuation(
                    `/account/verify?next=${encodeURIComponent(target)}`,
                  ),
                })
              : await client.signIn.email({
                  ...payload,
                  callbackURL: authContinuation(target),
                });
            if (result.error) throw new Error(result.error.message);
            if (
              result.data &&
              "twoFactorRedirect" in result.data &&
              result.data.twoFactorRedirect
            ) {
              setSecondStep(true);
              return;
            }
            window.location.assign(
              signup
                ? `/account/verify?next=${encodeURIComponent(target)}`
                : authContinuation(target),
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {signup && (
          <label>
            Full name
            <input name="name" autoComplete="name" required />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            minLength={10}
            autoComplete={signup ? "new-password" : "current-password"}
            required
          />
        </label>
        {!signup && (
          <a className="text-link forgot-link" href="/forgot-password">
            Forgot your password?
          </a>
        )}
        <button className="button" disabled={busy}>
          {busy
            ? "Please wait…"
            : signup
              ? "Create your account"
              : "Welcome back"}
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
    </>
  );
}
