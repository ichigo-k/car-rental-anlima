"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SquaresFour,
  CalendarBlank,
  Car,
  MapPin,
  CreditCard,
  Users,
  ClockCounterClockwise,
  ArrowUpRight,
} from "@phosphor-icons/react";
const icons = [
  SquaresFour,
  CalendarBlank,
  Car,
  MapPin,
  CreditCard,
  Users,
  ClockCounterClockwise,
  ArrowUpRight,
];
export function AdminNav({
  links,
}: {
  links: { href: string; label: string; icon: number }[];
}) {
  const path = usePathname();
  return (
    <nav aria-label="Staff navigation">
      {links.map((link) => {
        const Icon = icons[link.icon];
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={path === link.href ? "page" : undefined}
          >
            <Icon size={19} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
