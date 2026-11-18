import type { Metadata } from "next";
import { session } from "@/lib/auth";
import { safeAuthRedirect } from "@/lib/auth-redirect";
import { AuthCard } from "@/components/auth-card";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Email confirmed" };
// Where the confirmation link in the sign-up email lands. Better Auth adds
// ?error=… when the link has expired or was already used.
export default async function EmailConfirmed({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  const next = safeAuthRedirect(q.next);
  const verifyPage = `/account/verify?next=${encodeURIComponent(next)}`;
  if (q.error)
    return (
      <AuthCard
        eyebrow="EMAIL CONFIRMATION"
        title="This link no longer works"
        intro="It has expired or was already used. If you already confirmed your email, there is nothing more to do here."
      >
        <a className="button" href={verifyPage}>
          Check my account
        </a>
      </AuthCard>
    );
  const current = await session();
  const user = current?.user as
    { phoneNumberVerified?: boolean | null } | undefined;
  const phoneDone = !!user?.phoneNumberVerified;
  return (
    <AuthCard
      eyebrow="EMAIL CONFIRMATION"
      title="✓ Your email is confirmed"
      intro={
        phoneDone
          ? "Thank you. Your account is ready, and you can now book a car."
          : "Thank you. If you started on another tab or device, you can close this one; that page updates by itself."
      }
    >
      {phoneDone ? (
        <a className="button" href={next}>
          Continue
        </a>
      ) : (
        <>
          <p>One step left: confirm your mobile number with a text code.</p>
          <a className="button" href={verifyPage}>
            Confirm my mobile number
          </a>
        </>
      )}
    </AuthCard>
  );
}
