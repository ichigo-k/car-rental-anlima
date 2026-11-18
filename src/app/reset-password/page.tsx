import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ResetPassword } from "@/components/forgot-password";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Choose a new password" };
export default async function Reset({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  return (
    <AuthCard
      eyebrow="ACCOUNT HELP"
      title="Choose a new password"
      intro="Use at least 10 characters. Changing it signs you out on other devices."
    >
      {q.token && !q.error ? (
        <ResetPassword token={q.token} />
      ) : (
        <p className="error" role="alert">
          This reset link has expired or was already used.{" "}
          <Link href="/forgot-password" className="text-link">
            Request a new link
          </Link>
        </p>
      )}
    </AuthCard>
  );
}
