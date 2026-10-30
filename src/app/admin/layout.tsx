import Link from "next/link";
import { redirect } from "next/navigation";
import { session } from "@/lib/auth";
import Image from "next/image";
import { AdminNav } from "@/components/admin-nav";
import { SignOut } from "@/components/sign-out";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await session();
  if (!current) redirect("/sign-in?next=/admin");
  if (
    !["ADMIN", "MANAGER", "AGENT", "FLEET", "FINANCE"].includes(
      current.user.role,
    )
  )
    return (
      <main className="section empty">
        <h1>Staff access required.</h1>
        <p>This workspace is available to authorised ANLIMA staff.</p>
        <Link className="button" href="/bookings">
          My bookings
        </Link>
      </main>
    );
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
        <AdminNav
          links={[
            { href: "/admin", label: "Overview", icon: 0 },
            ...(["ADMIN", "MANAGER", "AGENT"].includes(current.user.role)
              ? [{ href: "/admin/bookings", label: "Bookings", icon: 1 }]
              : []),
            { href: "/admin/fleet", label: "Cars & availability", icon: 2 },
            ...(["ADMIN", "MANAGER", "FINANCE"].includes(current.user.role)
              ? [
                  {
                    href: "/admin/promotions",
                    label: "Promotions & vouchers",
                    icon: 4,
                  },
                ]
              : []),
            ...(["ADMIN", "MANAGER", "FLEET"].includes(current.user.role)
              ? [{ href: "/admin/tracking", label: "Fleet tracking", icon: 3 }]
              : []),
            ...(["ADMIN", "MANAGER", "FINANCE"].includes(current.user.role)
              ? [
                  {
                    href: "/admin/payments",
                    label: "Payments & reports",
                    icon: 4,
                  },
                ]
              : []),
            ...(["ADMIN", "MANAGER", "AGENT"].includes(current.user.role)
              ? [{ href: "/admin/customers", label: "Customers", icon: 5 }]
              : []),
            ...(["ADMIN", "MANAGER", "AGENT"].includes(current.user.role)
              ? [
                  {
                    href: "/admin/enquiries",
                    label: "Customer enquiries",
                    icon: 5,
                  },
                ]
              : []),
            ...(["ADMIN", "MANAGER"].includes(current.user.role)
              ? [{ href: "/admin/audit", label: "Activity history", icon: 6 }]
              : []),
            { href: "/", label: "Customer website", icon: 7 },
          ]}
        />
        <p className="sample-note">
          Signed in as {current.user.name}
          <br />
          {current.user.role}
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
