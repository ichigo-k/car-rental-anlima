import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Header } from "./header";
import { MapPin } from "./icons";

export function PageState({
  title,
  description,
  label,
  children,
}: {
  title: string;
  description: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="page-state-shell">
      <div className="page-state-photo" aria-hidden="true">
        <Image
          src="/images/figma/home-imgEnhanceThisImage2K20261006134800Photoroom1.png"
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
        <div className="page-state-photo-overlay" />
        <span className="page-state-tagline">ANLIMA · Drive with confidence.</span>
      </div>

      <div className="page-state-panel">
        <Header />

        <main className="page-state-content">
          <span className="page-state-icon" aria-hidden="true">
            <MapPin size={22} />
          </span>
          <p className="page-state-label">{label}</p>
          <h1 className="page-state-title">{title}</h1>
          <p className="page-state-description">{description}</p>

          <div className="page-state-actions">{children}</div>

          <Link href="/" className="page-state-home">
            <span className="page-state-home-arrow">←</span>
            Back to the homepage
          </Link>
        </main>
      </div>
    </div>
  );
}
