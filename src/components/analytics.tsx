"use client";
import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { isPrivatePath, withoutQuery } from "@/lib/analytics";

// Privacy-friendly analytics (Guide §10) with Umami: no cookies and no
// personal data. Page views are sent by hand so that private pages (account,
// bookings, sign-in, staff) are never counted and query strings, which can
// hold tokens or booking references, are never sent.
// Set NEXT_PUBLIC_UMAMI_WEBSITE_ID (and NEXT_PUBLIC_UMAMI_SCRIPT_URL when
// self-hosting) to switch it on; without them nothing loads.
const WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
const SCRIPT_URL =
  process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL ||
  "https://cloud.umami.is/script.js";
type Umami = {
  track: (
    event?:
      string | ((props: Record<string, unknown>) => Record<string, unknown>),
    data?: Record<string, string | number>,
  ) => void;
};
const umami = () => (globalThis as unknown as { umami?: Umami }).umami;
let lastView = { path: "", at: 0 };
// Events wait here until the script has loaded, then go in order.
const queue: (() => void)[] = [];
function flush() {
  while (umami() && queue.length) queue.shift()!();
}
// Every payload leaves with the path and referrer stripped of query strings.
// The address is taken when the event happens, not when it is sent.
function send(extra: Record<string, unknown> = {}) {
  if (!WEBSITE_ID) return;
  const url = withoutQuery(location.pathname);
  queue.push(() =>
    umami()?.track((props) => ({
      ...props,
      url,
      referrer: withoutQuery(props.referrer),
      ...extra,
    })),
  );
  flush();
}

// Booking-funnel events: search, car viewed, checkout started and booking
// confirmed. Only non-personal details (car, category, provider) are sent.
export function trackEvent(
  name: string,
  data?: Record<string, string | number>,
) {
  try {
    send({ name, ...(data ? { data } : {}) });
  } catch {
    // Analytics must never affect the page.
  }
}

export function Analytics() {
  const path = usePathname();
  useEffect(() => {
    if (isPrivatePath(path)) return;
    // One view per page, even if the page renders twice in quick succession.
    const now = Date.now();
    if (lastView.path === path && now - lastView.at < 2000) return;
    lastView = { path, at: now };
    send();
  }, [path]);
  if (!WEBSITE_ID) return null;
  return (
    <Script
      src={SCRIPT_URL}
      data-website-id={WEBSITE_ID}
      data-auto-track="false"
      data-do-not-track="true"
      data-domains="anlimacarrental.com"
      strategy="afterInteractive"
      onLoad={flush}
    />
  );
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
    // Once per page view.
    if (sent.current) return;
    sent.current = true;
    trackEvent(name, data);
  }, [name, data]);
  return null;
}
