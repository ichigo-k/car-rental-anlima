import Image from "next/image";
import Link from "next/link";
import { AccountLinks } from "./favourites";
const links = [
  ["/", "Home"],
  ["/fleet", "Cars"],
  ["/about", "About Us"],
  ["/contact", "Contact"],
];
export function Header({
  overlay = false,
  active = "",
}: {
  overlay?: boolean;
  active?: string;
}) {
  return (
    <header
      className={`header design-header ${overlay ? "header-overlay" : ""}`}
    >
      <Link href="/" className="design-brand" aria-label="Anlima home">
        <Image
          src="/images/figma/home-imgImage2.png"
          alt="ANLIMA Car Rental"
          width={235}
          height={117}
          preload
        />
      </Link>
      <nav aria-label="Main navigation">
        {links.map(([href, label]) => (
          <Link
            href={href}
            key={label}
            aria-current={active === label ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <details className="mobile-nav">
        <summary>Menu</summary>
        <nav aria-label="Mobile navigation">
          {links.map(([href, label]) => (
            <Link href={href} key={label}>
              {label}
            </Link>
          ))}
          <Link href="/auth/continue">My account</Link>
        </nav>
      </details>
      <AccountLinks />
      <Link href="/fleet#browse" className="button small">
        BOOK A CAR
      </Link>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="design-footer" id="contact">
      <div className="design-footer-grid">
        <div className="footer-brand-copy">
          <Link href="/" className="design-brand">
            <Image
              src="/images/figma/home-imgImage2.png"
              alt="ANLIMA Car Rental"
              width={227}
              height={113}
            />
          </Link>
          <p>Drive with Confidence.</p>
          <p>
            Your journey starts here. Find the right car for your needs and
            enjoy a convenient car rental experience with ANLIMA.
          </p>
        </div>
        <div>
          <h3>QUICK LINKS</h3>
          {links.map(([href, label]) => (
            <Link key={label} href={href}>
              {label === "Cars" ? "Our Fleet" : label}
            </Link>
          ))}
        </div>
        <div>
          <h3>YOUR JOURNEY</h3>
          <Link href="/how-it-works">How It Works</Link>
          <Link href="/bookings">My bookings</Link>
          <Link href="/policies">Rental guide</Link>
          <span>Accra, Ghana</span>
          <Link href="/admin">Staff workspace</Link>
        </div>
        <div>
          <h3>Legal</h3>
          <Link href="/policies">Privacy Policy</Link>
          <Link href="/policies">Terms & Conditions</Link>
          <Link href="/policies">Cancellation Policy</Link>
        </div>
      </div>
      <div className="design-footer-bottom">
        <span>
          © {new Date().getFullYear()} ANLIMA Car Rental. All rights reserved.
        </span>
        <img
          src="/images/figma/home-imgFrame160.svg"
          alt="Social media"
          width="135"
          height="28"
        />
      </div>
    </footer>
  );
}
