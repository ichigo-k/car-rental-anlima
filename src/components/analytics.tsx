"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isPrivatePath, withoutQuery } from "@/lib/analytics";

// First-party analytics (Guide §10; src/lib/site-analytics.ts): page views of
// public pages and booking-funnel events go to /api/collect. No cookies, and
// addresses leave without query strings, which can hold tokens or booking
// references.
let lastView = { path: "", at: 0 };
let referrerSent = false;
function report(type: string, data?: Record<string, string | number>) {
  try {
    // The visitor's previous website, only with the first page of the visit.
    const referrer = referrerSent ? "" : withoutQuery(document.referrer);
    referrerSent = true;
    void fetch("/api/collect", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        type,
        path: withoutQuery(location.pathname),
        referrer,
        ...(data ? { data } : {}),
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never affect the page.
  }
}

// Booking-funnel events: search, car viewed, checkout started and booking
// confirmed. Only non-personal details (car, category, provider) are sent.
export function trackEvent(
  name: string,
  data?: Record<string, string | number>,
) {
  report(name, data);
}

export function Analytics() {
  const path = usePathname();
  useEffect(() => {
    if (isPrivatePath(path)) return;
    // One view per page, even if the page renders twice in quick succession.
    const now = Date.now();
    if (lastView.path === path && now - lastView.at < 2000) return;
    lastView = { path, at: now };
    report("pageview");
  }, [path]);
  return null;
}

// Records a funnel event once when a page or section appears.
export function TrackOnView({
  name,
  data,
}: {
  name: string;
  data?: Record<string, string | number>;
}) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackEvent(name, data);
  }, [name, data]);
  return null;
}
