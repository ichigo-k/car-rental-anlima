import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { ForgotPassword } from "@/components/forgot-password";
export const metadata: Metadata = { title: "Reset your password" };
export default function Forgot() {
  return (
    <AuthCard
      eyebrow="ACCOUNT HELP"
      title="Forgot your password?"
      intro="Choose how you would like to reset it. Staff accounts still need their authenticator code to sign in afterwards."
    >
      <ForgotPassword />
    </AuthCard>
  );
}
