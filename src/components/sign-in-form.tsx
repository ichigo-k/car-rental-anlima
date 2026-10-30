"use client";
import { createAuthClient } from "better-auth/react";
import { useState } from "react";
import { GoogleLogo, FacebookLogo } from "@phosphor-icons/react";
import { safeAuthRedirect } from "@/lib/auth-redirect";
const client = createAuthClient();
export function SignInForm({
  providers = { google: false, facebook: false },
}: {
  providers?: { google: boolean; facebook: boolean };
}) {
  const [signup, setSignup] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
        callbackURL: target,
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
                  callbackURL: target,
                })
              : await client.signIn.email({ ...payload, callbackURL: target });
            if (result.error) throw new Error(result.error.message);
            window.location.assign(target);
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
