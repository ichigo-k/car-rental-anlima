import { SignInForm } from "@/components/sign-in-form";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  return (
    <div className="auth-shell">
      {/* ── Left: photo + brand copy ── */}
      <div className="auth-left" aria-hidden="true">
        <Image
          src="/images/figma/home-imgEnhanceThisImage2K20261006134800Photoroom1.png"
          alt=""
          fill
          sizes="50vw"
          priority
          className="auth-left-photo"
        />
        <div className="auth-left-overlay" />

        <div className="auth-left-content">
          <Link href="/" className="auth-brand">
            <Image
              src="/images/figma/home-imgImage2.png"
              alt="ANLIMA Car Rental"
              width={160}
              height={80}
              className="auth-logo"
            />
          </Link>

          <div className="auth-left-copy">
            <p className="auth-eyebrow">THE ROAD IS CALLING</p>
            <h1 className="auth-headline">
              Your next drive.<br />All in one place.
            </h1>
            <p className="auth-tagline">
              Save the cars you love. Reserve your next journey.<br />
              Pick up where you left off.
            </p>
          </div>

          <p className="auth-photo-caption">A little more freedom. Anlima.</p>
        </div>
      </div>

      {/* ── Right: form card ── */}
      <div className="auth-right">
        {/* Mobile-only logo */}
        <Link href="/" className="auth-mobile-logo">
          <Image
            src="/images/figma/home-imgImage2.png"
            alt="ANLIMA Car Rental"
            width={130}
            height={65}
          />
        </Link>

        <div className="auth-form-wrap">
          <div className="auth-form-header">
            <h2>Welcome to Anlima.</h2>
            <p className="auth-subtitle">Your next journey starts with you.</p>
          </div>

          {q.error === "social" && (
            <p className="error" role="alert">
              Sign-in was cancelled or could not be completed. Try again or use
              your email.
            </p>
          )}

          <SignInForm
            providers={{
              google: !!(
                process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
              ),
              facebook: !!(
                process.env.FACEBOOK_CLIENT_ID &&
                process.env.FACEBOOK_CLIENT_SECRET
              ),
            }}
          />

          <p className="auth-legal">
            By continuing you agree to our{" "}
            <Link href="/policies">rental terms and privacy notice</Link>.
          </p>
        </div>

        <p className="auth-back">
          <Link href="/">← Back to homepage</Link>
        </p>
      </div>
    </div>
  );
}
