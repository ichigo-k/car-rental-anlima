import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { session } from "@/lib/auth";
import { safeAuthRedirect } from "@/lib/auth-redirect";
import { AuthCard } from "@/components/auth-card";
import { VerifyAccount } from "@/components/verify-account";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify your account" };
export default async function Verify({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  const next = safeAuthRedirect(q.next);
  const current = await session();
  if (!current)
    redirect(
      `/sign-in?next=${encodeURIComponent(`/account/verify?next=${encodeURIComponent(next)}`)}`,
    );
  const user = current.user as typeof current.user & {
    phoneNumber?: string | null;
    phoneNumberVerified?: boolean | null;
  };
  return (
    <AuthCard
      eyebrow="BEFORE YOU BOOK"
      title="Confirm your email and mobile number"
      intro="We use them to send your booking confirmation, pickup details and reminders. You only need to do this once."
    >
      {q.error && (
        <p className="error" role="alert">
          That confirmation link has expired or was already used. Send a new one
          below.
        </p>
      )}
      <VerifyAccount
        email={user.email}
        emailVerified={user.emailVerified}
        phone={user.phoneNumber ?? null}
        phoneVerified={!!user.phoneNumberVerified}
        next={next}
      />
    </AuthCard>
  );
}
