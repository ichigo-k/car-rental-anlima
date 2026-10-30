import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Car, CalendarBlank, ShieldCheck, ArrowUpRight } from "./icons";
import { SignOut } from "./sign-out";
export function CustomerShell({
  name,
  email,
  active,
  children,
}: {
  name: string;
  email: string;
  active: "bookings" | "favourites";
  children: ReactNode;
}) {
  return (
    <div className="customer-workspace">
      <aside className="account-sidebar">
        <Link href="/" className="design-brand" aria-label="Anlima home">
          <Image
            src="/images/figma/home-imgImage2.png"
            alt="ANLIMA Car Rental"
            width={235}
            height={117}
          />
        </Link>
        <Link href="/fleet" className="sidebar-browse">
          Explore the fleet <ArrowUpRight size={16} />
        </Link>
        <nav aria-label="Account navigation">
          <Link
            href="/bookings"
            aria-current={active === "bookings" ? "page" : undefined}
          >
            <CalendarBlank size={20} />
            My reservations
          </Link>
          <Link
            href="/favourites"
            aria-current={active === "favourites" ? "page" : undefined}
          >
            <Car size={20} />
            Favourite cars
          </Link>
          <Link href="/policies">
            <ShieldCheck size={20} />
            Rental guide
          </Link>
        </nav>
        <div className="sidebar-help">
          <h3>Ready for a change of scenery?</h3>
          <p>Your next drive is a few steps away.</p>
          <Link href="/fleet">
            Find a car <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="sidebar-profile">
          <span className="profile-initial">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{name}</strong>
            <small>{email}</small>
          </div>
        </div>
        <SignOut />
      </aside>
      <main className="account-main">
        <div className="account-topbar">
          <span>Your Anlima account</span>
          <Link href="/fleet">
            Book another journey <ArrowUpRight size={16} />
          </Link>
        </div>
        {children}
      </main>
    </div>
  );
}
