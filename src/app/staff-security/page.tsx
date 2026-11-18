import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { session } from "@/lib/auth";
import { isStaffRole } from "@/lib/permissions";
import { MfaSetup } from "@/components/mfa-setup";
import { SignOut } from "@/components/sign-out";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Secure your staff account" };
export default async function StaffSecurity() {
  const current = await session();
  if (!current) redirect("/sign-in?next=/staff-security");
  if (!isStaffRole(current.user.role)) redirect("/bookings");
  if (current.user.twoFactorEnabled) redirect("/admin");
  return (
    <main className="staff-security">
      <Link href="/" className="design-brand" aria-label="Anlima home">
        <Image
          src="/images/figma/home-imgImage2.png"
          alt="ANLIMA Car Rental"
          width={235}
          height={117}
        />
      </Link>
      <section className="admin-panel">
        <p className="eyebrow">STAFF ACCOUNT SECURITY</p>
        <h1>Turn on two-step sign-in</h1>
        <p>
          Staff accounts protect customer, payment and fleet data, so each
          sign-in needs your password and a code from an authenticator app on
          your phone.
        </p>
        <MfaSetup email={current.user.email} />
        <SignOut />
      </section>
    </main>
  );
}
