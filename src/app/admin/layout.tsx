import Link from "next/link";
import { redirect } from "next/navigation";
import { session } from "@/lib/auth";
import Image from "next/image";
import { AdminNav } from "@/components/admin-nav";
import { SignOut } from "@/components/sign-out";
import { can, isStaffRole, ROLE_LABELS } from "@/lib/permissions";
import type { Metadata } from "next";
import { privatePage } from "@/lib/seo";
export const metadata: Metadata = privatePage();
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await session();
  if (!current) redirect("/sign-in?next=/admin");
  if (!isStaffRole(current.user.role))
    return (
      <main className="section empty">
        <h1>Staff access required.</h1>
        <p>This workspace is available to authorised ANLIMA staff.</p>
        <Link className="button" href="/bookings">
          My bookings
        </Link>
      </main>
    );
  if (!current.user.twoFactorEnabled) redirect("/staff-security");
  const role = current.user.role;
  const links = [
    { href: "/admin", label: "Overview", icon: 0 },
    can(role, "booking.read") && {
      href: "/admin/bookings",
      label: "Bookings",
      icon: 1,
    },
    can(role, "booking.read") && {
      href: "/admin/notifications",
      label: "Notifications",
      icon: 5,
    },
    { href: "/admin/fleet", label: "Cars & availability", icon: 2 },
    can(role, "promotion.read") && {
      href: "/admin/promotions",
      label: "Promotions & vouchers",
      icon: 4,
    },
    can(role, "gps.view") && {
      href: "/admin/tracking",
      label: "Fleet tracking",
      icon: 3,
    },
    can(role, "payment.review") && {
      href: "/admin/payments",
      label: "Payments",
      icon: 4,
    },
    can(role, "report.export") && {
      href: "/admin/reports",
      label: "Reports",
      icon: 6,
    },
    can(role, "customer.read") && {
      href: "/admin/customers",
      label: "Customers",
      icon: 5,
    },
    can(role, "enquiry.read") && {
      href: "/admin/enquiries",
      label: "Customer enquiries",
      icon: 5,
    },
    can(role, "review.manage") && {
      href: "/admin/reviews",
      label: "Reviews",
      icon: 5,
    },
    can(role, "user.manage") && {
      href: "/admin/staff",
      label: "Staff & access",
      icon: 5,
    },
    can(role, "settings.manage") && {
      href: "/admin/settings",
      label: "Fees & settings",
      icon: 8,
    },
    can(role, "audit.read") && {
      href: "/admin/audit",
      label: "Activity history",
      icon: 6,
    },
    { href: "/", label: "Customer website", icon: 7 },
  ].filter((link) => !!link);
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Link href="/" className="design-brand" aria-label="Anlima home">
          <Image
            src="/images/figma/home-imgImage2.png"
            alt="ANLIMA Car Rental"
            width={235}
            height={117}
          />
        </Link>
        <p className="workspace-label">STAFF WORKSPACE</p>
        <AdminNav links={links} />
        <p className="sample-note">
          Signed in as {current.user.name}
          <br />
          {ROLE_LABELS[role]}
        </p>
        <SignOut />
      </aside>
      <main className="admin-main">
        <div className="admin-workspace-bar">
          <span>Operations / Anlima</span>
          <span>Accra, Ghana · GMT</span>
        </div>
        {children}
      </main>
    </div>
  );
}
