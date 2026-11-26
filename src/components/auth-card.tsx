import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
// Centred card used by the verification and password pages.
export function AuthCard({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-card-page">
      <Link href="/" className="design-brand" aria-label="Anlima home">
        <Image
          src="/images/figma/home-imgImage2.png"
          alt="ANLIMA Car Rental"
          width={235}
          height={117}
        />
      </Link>
      <section className="auth-card">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{intro}</p>
        {children}
      </section>
    </main>
  );
}
